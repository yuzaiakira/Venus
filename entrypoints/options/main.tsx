import { createRoot } from "react-dom/client";
import { SettingsScreen } from "../../src/app/settings";
import { workspace } from "../../src/infrastructure/browser-workspace";
import "../../src/design/tokens.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing bundled application root");
createRoot(root).render(<SettingsScreen workspace={workspace} />);
