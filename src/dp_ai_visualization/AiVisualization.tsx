import React, { ReactElement } from "react";
import { CreatedVisualization } from "@gooddata/api-client-tiger";
import { IDashboardWidgetProps } from "@gooddata/sdk-ui-dashboard";
import { Button, Typography, Spinner } from "@gooddata/sdk-ui-kit";
import { BarChart, ColumnChart, Headline, LineChart, PieChart } from "@gooddata/sdk-ui-charts";
import { PivotTable } from "@gooddata/sdk-ui-pivot";
import { useAiVisualization } from "./useAiVisualization.js";

import {
    idRef,
    MeasureAggregation,
    newAttribute,
    newMeasure,
    GenAIFilter,
    newPositiveAttributeFilter,
    newNegativeAttributeFilter,
    newRelativeDateFilter,
    newAbsoluteDateFilter,
    DateAttributeGranularity,
    IFilter,
    GenAIPositiveAttributeFilter,
    GenAINegativeAttributeFilter,
    GenAIRelativeDateFilter,
    GenAIDateGranularity,
    GenAIAbsoluteDateFilter,
    IGenAIVisualizationMetric,
    MeasureBuilder,
    GenAIMetricType,
    ObjectType,
} from "@gooddata/sdk-model";

const VIS_HEIGHT = 400;

const visualizationTooltipOptions = {
    tooltip: {
        className: "gd-gen-ai-chat__vis_tooltip",
    },
};

const legendTooltipOptions = {
    legend: {
        responsive: "autoPositionWithPopup" as const,
    },
};

const renderBarChart = (visualization: any) => (
    <BarChart
        height={VIS_HEIGHT}
        measures={visualization.metrics || []}
        viewBy={[visualization.dimensions?.[0], visualization.dimensions?.[1]].filter(Boolean)}
        stackBy={visualization.metrics?.length <= 1 ? visualization.dimensions?.[2] : undefined}
        config={{
            ...visualizationTooltipOptions,
            ...legendTooltipOptions,
            // Better visibility with stacked bars if there are multiple metrics and dimensions
            stackMeasures: visualization.metrics?.length > 1 && visualization.dimensions?.length === 2,
        }}
    />
);

const renderColumnChart = (visualization: any) => (
    <ColumnChart
        height={VIS_HEIGHT}
        measures={visualization.metrics || []}
        viewBy={[visualization.dimensions?.[0], visualization.dimensions?.[1]].filter(Boolean)}
        stackBy={visualization.metrics?.length <= 1 ? visualization.dimensions?.[2] : undefined}
        config={{
            ...visualizationTooltipOptions,
            ...legendTooltipOptions,
            // Better visibility with stacked bars if there are multiple metrics and dimensions
            stackMeasures: visualization.metrics?.length > 1 && visualization.dimensions?.length === 2,
        }}
    />
);

const renderLineChart = (visualization: any) => (
    <LineChart
        height={VIS_HEIGHT}
        measures={visualization.metrics || []}
        trendBy={visualization.dimensions?.[0]}
        segmentBy={visualization.metrics?.length <= 1 ? visualization.dimensions?.[1] : undefined}
        config={{
            ...visualizationTooltipOptions,
            ...legendTooltipOptions,
        }}
    />
);

const renderPieChart = (visualization: any) => (
    <PieChart
        height={VIS_HEIGHT}
        measures={visualization.metrics || []}
        viewBy={visualization.metrics?.length <= 1 ? visualization.dimensions?.[0] : undefined}
        config={{
            ...visualizationTooltipOptions,
        }}
    />
);

const renderTable = (visualization: any) => (
    <PivotTable
        measures={visualization.metrics || []}
        rows={visualization.dimensions || []}
    />
);

const renderHeadline = (visualization: any) => (
    <Headline
        height={VIS_HEIGHT}
        primaryMeasure={visualization.metrics?.[0]}
        secondaryMeasures={[visualization.metrics?.[1], visualization.metrics?.[2]].filter(Boolean)}
    />
);

const renderVisualization = (execution: any, type: string) => {
    if (!execution) return null;
    
    switch (type) {
        case "BAR":
            return renderBarChart(execution);
        case "COLUMN":
            return renderColumnChart(execution);
        case "LINE":
            return renderLineChart(execution);
        case "PIE":
            return renderPieChart(execution);
        case "TABLE":
            return renderTable(execution);
        case "HEADLINE":
            return renderHeadline(execution);
        default:
            // Fallback to bar chart for unknown types
            return renderBarChart(execution);
    }
};

const useExecution = (vis: CreatedVisualization | null) => {
    return React.useMemo(() => {
        if (!vis) {
            return {
                metrics: [],
                dimensions: [],
                filters: [],
            };
        }

        return prepareExecution(vis);
    }, [vis]);
};

const typeMap: { [key in GenAIMetricType]: ObjectType } = {
    attribute: "attribute",
    fact: "fact",
    metric: "measure",
};

const prepareExecution = (vis: CreatedVisualization) => {
    const dimensions = vis.dimensionality?.map((d) => newAttribute(d.id)) ?? [];
    const metrics =
        vis.metrics?.map((md) => newMeasure(idRef(md.id, typeMap[md.type]), measureBuilder(md))) ?? [];
    // @ts-ignore
    const filters = (vis.filters?.map(convertFilter).filter(Boolean) as IFilter[]) ?? [];

    return { metrics, dimensions, filters };
};

const measureBuilder = (md: IGenAIVisualizationMetric) => (m: MeasureBuilder) => {
    if (md.title) {
        m = m.title(md.title);
    }

    if (md.type === "attribute") {
        m = m.aggregation("count");
    }

    if (md.type === "fact" && md.aggFunction) {
        m = m.aggregation(md.aggFunction.toLowerCase() as MeasureAggregation);
    }

    return m;
};

const convertFilter = (data: GenAIFilter): IFilter | false => {
    if (isPositiveAttributeFilter(data)) {
        return newPositiveAttributeFilter(idRef(data.using, "displayForm"), { values: data.include });
    }

    if (isNegativeAttributeFilter(data)) {
        return newNegativeAttributeFilter(idRef(data.using, "displayForm"), { values: data.exclude });
    }

    if (isRelativeDateFilter(data)) {
        return newRelativeDateFilter(
            idRef(data.using, "dataSet"),
            granularityMap[data.granularity],
            data.from,
            data.to,
        );
    }

    if (isAbsoluteDateFilter(data)) {
        return newAbsoluteDateFilter(
            idRef(data.using, "dataSet"),
            data.from ??
                (() => {
                    const date = new Date();
                    date.setUTCHours(0, 0, 0, 0);
                    return date.toISOString();
                })(),
            data.to ?? new Date().toISOString(),
        );
    }

    return false;
};

const isPositiveAttributeFilter = (obj: unknown): obj is GenAIPositiveAttributeFilter => {
    return typeof obj === "object" && obj !== null && "using" in obj && "include" in obj;
};

const isNegativeAttributeFilter = (obj: unknown): obj is GenAINegativeAttributeFilter => {
    return typeof obj === "object" && obj !== null && "using" in obj && "exclude" in obj;
};

const isRelativeDateFilter = (obj: unknown): obj is GenAIRelativeDateFilter => {
    return typeof obj === "object" && obj !== null && "using" in obj && "granularity" in obj;
};

const isAbsoluteDateFilter = (obj: unknown): obj is GenAIAbsoluteDateFilter => {
    return typeof obj === "object" && obj !== null && "using" in obj && ("from" in obj || "to" in obj);
};

const granularityMap: { [key in GenAIDateGranularity]: DateAttributeGranularity } = {
    MINUTE: "GDC.time.minute",
    HOUR: "GDC.time.hour",
    DAY: "GDC.time.date",
    WEEK: "GDC.time.week",
    MONTH: "GDC.time.month",
    QUARTER: "GDC.time.quarter",
    YEAR: "GDC.time.year",
    MINUTE_OF_HOUR: "GDC.time.minute_in_hour",
    HOUR_OF_DAY: "GDC.time.hour_in_day",
    DAY_OF_WEEK: "GDC.time.day_in_week",
    DAY_OF_MONTH: "GDC.time.day_in_month",
    DAY_OF_YEAR: "GDC.time.day_in_year",
    WEEK_OF_YEAR: "GDC.time.week_in_year",
    MONTH_OF_YEAR: "GDC.time.month_in_year",
    QUARTER_OF_YEAR: "GDC.time.quarter_in_year",
};

export const getAiVisualization = (dashboardId: string) => function AiVisualization(_props: IDashboardWidgetProps): ReactElement {
    const {
        question,
        setQuestion,
        isLoading,
        isInitialLoading,
        visualizationData,
        handleSubmit,
        handleReset,
        error,
        initialError,
    } = useAiVisualization(dashboardId);
    const execution = useExecution(visualizationData);

    // Show initial loading state
    if (isInitialLoading) {
        return (
            <div style={{ padding: "20px", textAlign: "center" }}>
                <Spinner />
                <p style={{ marginTop: "16px", color: "#666" }}>
                    Loading previous visualizations...
                </p>
            </div>
        );
    }

    // Show initial error state
    if (initialError && !visualizationData) {
        return (
            <div style={{ padding: "20px" }}>
                <div 
                    style={{ 
                        marginBottom: "20px", 
                        padding: "12px", 
                        backgroundColor: "#fef2f2", 
                        border: "1px solid #fecaca", 
                        borderRadius: "6px",
                        color: "#dc2626"
                    }}
                >
                    <p style={{ margin: 0, fontWeight: "500" }}>
                        Error: {initialError}
                    </p>
                    <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                        Failed to load previous visualizations. You can still create new ones.
                    </p>
                </div>
                
                <Typography tagName="p">
                    Didn&apos;t find the visualization you were looking for? Request a custom AI-generated chart or graph here!
                </Typography>

                <div style={{ marginBottom: "20px" }}>
                    <Typography tagName="p">
                        <label htmlFor="visualization-question" style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                            Describe what you&apos;d like to visualize:
                        </label>
                    </Typography>
                    <textarea
                        id="visualization-question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g., 'Show me a bar chart of sales by region for Q4 2023' or 'Create a pie chart showing customer satisfaction scores'"
                        rows={4}
                        style={{ width: "100%", resize: "vertical", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!question.trim() || isLoading}
                    >
                        {isLoading ? "Generating..." : "Generate Visualization"}
                    </Button>
                    {question.trim() && (
                        <Button
                            variant="secondary"
                            onClick={() => setQuestion("")}
                        >
                            Clear
                        </Button>
                    )}
                </div>

                {isLoading && (
                    <div 
                        style={{ 
                            marginTop: "20px", 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "10px",
                            color: "#666"
                        }}
                    >
                        <Spinner />
                        <span>
                            AI is processing your request... This may take a few moments.
                        </span>
                    </div>
                )}
            </div>
        );
    }

    if (visualizationData) {
        return (
            <div className="ai-visualization-container" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <Typography tagName="h2">
                        {visualizationData.title || "AI-Generated Visualization"}
                    </Typography>
                    <Button 
                        variant="secondary" 
                        onClick={handleReset}
                        disabled={isLoading}
                    >
                        Ask again
                    </Button>
                </div>
                
                <div 
                    className="visualization-wrapper" 
                    style={{ 
                        border: "1px solid #e5e7eb", 
                        borderRadius: "8px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        height: VIS_HEIGHT,
                    }}
                >
                    {renderVisualization(execution, visualizationData.visualizationType?.toUpperCase() || "BAR")}
                </div>
            </div>
        );
    }

    return (
        <div className="ai-visualization-form" style={{ padding: "20px" }}>
            <Typography tagName="p">
                Didn&apos;t find the visualization you were looking for? Request a custom AI-generated chart or graph here!
            </Typography>

            {error && (
                <div 
                    style={{ 
                        marginBottom: "20px", 
                        padding: "12px", 
                        backgroundColor: "#fef2f2", 
                        border: "1px solid #fecaca", 
                        borderRadius: "6px",
                        color: "#dc2626"
                    }}
                >
                    <p style={{ margin: 0, fontWeight: "500" }}>
                        Error: {error}
                    </p>
                    <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                        Please try again later.
                    </p>
                </div>
            )}

            <div style={{ marginBottom: "20px" }}>
                <Typography tagName="p">
                    <label htmlFor="visualization-question" style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                        Describe what you&apos;d like to visualize:
                    </label>
                </Typography>
                <textarea
                    id="visualization-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., 'Show me a bar chart of sales by region for Q4 2023' or 'Create a pie chart showing customer satisfaction scores'"
                    rows={4}
                    style={{ width: "100%", resize: "vertical", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!question.trim() || isLoading}
                >
                    {isLoading ? "Generating..." : "Generate Visualization"}
                </Button>
                {question.trim() && (
                    <Button
                        variant="secondary"
                        onClick={() => setQuestion("")}
                    >
                        Clear
                    </Button>
                )}
            </div>

            {isLoading && (
                <div 
                    style={{ 
                        marginTop: "20px", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "10px",
                        color: "#666"
                    }}
                >
                    <Spinner />
                    <span>
                        AI is processing your request... This may take a few moments.
                    </span>
                </div>
            )}
        </div>
    );
}
