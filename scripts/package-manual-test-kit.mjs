import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";

const prohibitedSegment = /^(?:\.git|node_modules|\.cache|cache|profiles?)$/i;
const prohibitedFile =
  /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key)|id_rsa|credentials?(?:\..*)?)$/i;
const dosDate = 33; // 1980-01-01, required by the ZIP format.

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node scripts/package-manual-test-kit.mjs [--input kit-dir] [--out kit.zip]",
  );
  process.exitCode = 1;
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values[key]) {
      usage(`Invalid argument: ${key ?? ""}`);
      return null;
    }
    values[key] = value;
  }
  return values;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function inputFiles(root) {
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const entry = relative(root, path).replaceAll("\\", "/");
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symlink rejected: ${entry}`);
      if (stat.isDirectory()) {
        if (prohibitedSegment.test(name))
          throw new Error(`Prohibited directory rejected: ${entry}`);
        visit(path);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Non-file rejected: ${entry}`);
      if (prohibitedFile.test(entry))
        throw new Error(`Sensitive file name rejected: ${entry}`);
      files.push({ path: entry, bytes: readFileSync(path) });
    }
  }
  visit(root);
  return files;
}

function localHeader(file) {
  const name = Buffer.from(file.path, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(file.crc, 14);
  header.writeUInt32LE(file.bytes.length, 18);
  header.writeUInt32LE(file.bytes.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name, file.bytes]);
}

function centralHeader(file) {
  const name = Buffer.from(file.path, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(file.crc, 16);
  header.writeUInt32LE(file.bytes.length, 20);
  header.writeUInt32LE(file.bytes.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(file.offset, 42);
  return Buffer.concat([header, name]);
}

function archive(files) {
  const local = [];
  let offset = 0;
  for (const file of files) {
    file.offset = offset;
    const entry = localHeader(file);
    local.push(entry);
    offset += entry.length;
  }
  const central = Buffer.concat(files.map(centralHeader));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, central, end]);
}

const values = argumentsFrom(process.argv.slice(2));
if (!values) process.exit();
const input = resolve(values["--input"] ?? "artifacts/venus-manual-test-kit");
const output = resolve(
  values["--out"] ?? "artifacts/venus-manual-test-kit.zip",
);
if (!existsSync(input)) {
  usage(`Kit directory does not exist: ${input}`);
} else if (existsSync(output)) {
  usage(`Refusing to overwrite existing archive: ${output}`);
} else {
  try {
    if (!relative(input, output).startsWith(".."))
      throw new Error("Archive output must be outside the kit directory");
    const manifest = resolve(input, "manifest-inventory.json");
    const report = resolve(input, "acceptance-results.json");
    if (!existsSync(manifest) || !existsSync(report))
      throw new Error("Input is not a prepared manual test kit");
    const files = inputFiles(input).map((file) => ({
      ...file,
      crc: crc32(file.bytes),
    }));
    if (files.length > 0xffff) throw new Error("Too many ZIP entries");
    mkdirSync(dirname(output), { recursive: true });
    const bytes = archive(files);
    writeFileSync(output, bytes);
    console.log(
      JSON.stringify(
        {
          archive: output,
          files: files.length,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
        null,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
