// (C) 2021-2025 GoodData Corporation
import {
    DashboardContext,
    DashboardPluginV1,
    IDashboardCustomizer,
    IDashboardEventHandling,
    newCustomWidget,
    newDashboardItem,
    newDashboardSection,
} from "@gooddata/sdk-ui-dashboard";

// this import will be renamed in plugin-toolkit
import entryPoint from "../dp_ai_visualization_entry/index.js";

import { getAiVisualization } from "./AiVisualization.js";

export class Plugin extends DashboardPluginV1 {
    public readonly author = entryPoint.author;
    public readonly displayName = entryPoint.displayName;
    public readonly version = entryPoint.version;
    public readonly minEngineVersion = entryPoint.minEngineVersion;
    public readonly maxEngineVersion = entryPoint.maxEngineVersion;
    public readonly compatibility = entryPoint.compatibility;

    public register(
        ctx: DashboardContext,
        customize: IDashboardCustomizer,
        _handlers: IDashboardEventHandling,
    ): void {
        // @ts-ignore
        const dashboardId = ctx.dashboardRef?.identifier ?? "new";
        customize.customWidgets().addCustomWidget("aiVisualization", getAiVisualization(dashboardId));
        customize.layout().customizeFluidLayout((layout, customizer) => {
            customizer.addSectionToPath(
                {sectionIndex: layout.sections.length},
                newDashboardSection(
                    "Ask AI Assistant",
                    newDashboardItem(newCustomWidget("myWidget1", "aiVisualization"), {
                        xl: {
                            // all 12 columns of the grid will be 'allocated' for this new item
                            gridWidth: 12,
                            // minimum height since the custom widget now has just some one-liner text
                            gridHeight: 1,
                        },
                    }),
                ),
            );
        });
    }
}
