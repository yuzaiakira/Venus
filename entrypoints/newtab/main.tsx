import { createRoot } from "react-dom/client";
import { DashboardScreen } from "../../src/app/dashboard";
import { browserBookmarks } from "../../src/infrastructure/browser-bookmarks";
import {
  calendar,
  goals,
  plugins,
  productivity,
  reviews,
  workspace,
} from "../../src/infrastructure/browser-workspace";
import "../../src/design/tokens.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing bundled application root");
createRoot(root).render(
  <DashboardScreen
    workspace={workspace}
    productivity={productivity}
    bookmarks={browserBookmarks}
    calendar={calendar}
    goals={goals}
    reviews={reviews}
    plugins={plugins}
    online={navigator.onLine}
  />,
);
