import { definePlugin, routerHook } from "@decky/api";
import { staticClasses } from "@decky/ui";

import { TEAM_BUILDER_ROUTE, TeamBuilderPage } from "./pages/TeamBuilderPage";
import { QuickAccessPanel } from "./panel/QuickAccessPanel";
import { teamStore } from "./state/teamStore";
import { IconDigiEgg } from "./ui/icons";

export default definePlugin(() => {
  routerHook.addRoute(TEAM_BUILDER_ROUTE, TeamBuilderPage, { exact: true });

  // Warm the store so the panel has the saved team ready the first time it opens.
  teamStore.hydrate();

  return {
    name: "Digimon Time Stranger Team Builder",
    titleView: <div className={staticClasses.Title}>Team Builder</div>,
    content: <QuickAccessPanel />,
    icon: <IconDigiEgg />,
    onDismount() {
      teamStore.flush();
      routerHook.removeRoute(TEAM_BUILDER_ROUTE);
    },
  };
});
