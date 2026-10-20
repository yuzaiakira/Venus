import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DocumentView } from "../../src/app/library";
import {
  convertBlock,
  replaceBlockText,
  toggleBlockMark,
  type NoteBlock,
} from "../../src/domain/productivity";

describe("repair: rich note content", () => {
  const list: NoteBlock = {
    type: "taskList",
    content: [
      {
        type: "taskItem",
        checked: true,
        content: [{ type: "text", text: "one", marks: [{ type: "bold" }] }],
      },
      {
        type: "taskItem",
        checked: false,
        content: [{ type: "text", text: "two" }],
      },
    ],
  };
  it("preserves every list item, checkbox and formatting during edits", () => {
    const result = replaceBlockText(list, "first\nsecond\nthird");
    expect(result.type).toBe("taskList");
    if (result.type !== "taskList") throw new Error("wrong type");
    expect(result.content).toHaveLength(3);
    expect(result.content[0]).toMatchObject({
      checked: true,
      content: [{ text: "first", marks: [{ type: "bold" }] }],
    });
    expect(result.content[1]).toMatchObject({
      checked: false,
      content: [{ text: "second" }],
    });
    const formatted = toggleBlockMark(result, "italic");
    expect(formatted.content).toHaveLength(3);
    const converted = convertBlock(formatted, "bulletList");
    expect(converted.content).toHaveLength(3);
    expect(JSON.stringify(convertBlock(converted, "paragraph"))).toContain(
      "first",
    );
    expect(JSON.stringify(convertBlock(converted, "paragraph"))).toContain(
      "third",
    );
  });
  it("renders every item and individual mark safely without raw HTML", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentView, {
        document: {
          type: "doc",
          content: [
            list,
            {
              type: "paragraph",
              content: [
                { type: "text", text: "<img onerror=alert(1)>" },
                {
                  type: "text",
                  text: "unsafe",
                  marks: [{ type: "link", href: "javascript:alert(1)" }],
                },
                {
                  type: "text",
                  text: "safe",
                  marks: [{ type: "link", href: "https://example.com" }],
                },
              ],
            },
          ],
        },
      }),
    );
    expect(html).toContain("one");
    expect(html).toContain("two");
    expect(html).toContain("<strong>");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
