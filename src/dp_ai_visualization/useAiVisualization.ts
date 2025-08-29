import { CreatedVisualization, ITigerClient } from "@gooddata/api-client-tiger";
import { IAnalyticalBackend } from "@gooddata/sdk-backend-spi";
import { useBackendStrict, useWorkspaceStrict } from "@gooddata/sdk-ui";
import { useState, useCallback, useMemo, useEffect } from "react";

export interface UseAiVisualizationReturn {
    question: string;
    setQuestion: (question: string) => void;
    isLoading: boolean;
    isInitialLoading: boolean;
    visualizationData: CreatedVisualization | null;
    handleSubmit: () => Promise<void>;
    handleReset: () => Promise<void>;
    error: string | null;
    initialError: string | null;
}

export function useAiVisualization(dashboardId: string): UseAiVisualizationReturn {
    const [question, setQuestion] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [visualizationData, setVisualizationData] = useState<CreatedVisualization | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialError, setInitialError] = useState<string | null>(null);
    
    const backend = useBackendStrict();
    const workspace = useWorkspaceStrict();
    const client = useMemo(() => {
        return getApiClientDirtyHack(backend);
    }, [backend]);

    // Load previously generated visualizations on first render
    useEffect(() => {
        const loadPreviousVisualizations = async () => {
            try {
                setIsInitialLoading(true);
                setInitialError(null);

                const history = await client.genAI.aiChatHistory({
                    workspaceId: workspace,
                    chatHistoryRequest: {
                        threadIdSuffix: dashboardId,
                    },
                });

                if (history.status !== 200) {
                    return;
                }

                const lastInteraction = history.data.interactions?.[history.data.interactions?.length - 1];

                if (!lastInteraction) {
                    return;
                }

                const visualization = lastInteraction.createdVisualizations?.objects?.[0];

                if (!visualization) {
                    return;
                }

                setVisualizationData(visualization);
            } catch (err) {
                console.error("Failed to load previous visualizations:", err);
                setInitialError("Failed to load previous visualizations");
            } finally {
                setIsInitialLoading(false);
            }
        };

        if (client && workspace) {
            loadPreviousVisualizations();
        }
    }, [client, workspace, dashboardId]);

    const handleSubmit = useCallback(async () => {
        if (!question.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await client.genAI.aiChat({
                workspaceId: workspace,
                chatRequest: {
                    question,
                    threadIdSuffix: dashboardId,
                },
            });

            if (result.status !== 200 || !result.data.createdVisualizations?.objects.length) {
                setError("Failed to generate visualization");
                setQuestion("");
                setVisualizationData(null);
                return;
            }

            setVisualizationData(result.data.createdVisualizations.objects[0]);
            setQuestion(""); // Clear the question after successful generation

        } catch (err) {
            console.error("Failed to generate visualization:", err);
            setError("Failed to generate visualization. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    }, [question, client, workspace, dashboardId]);

    const handleReset = useCallback(async () => {
        // Prevent reset while any operation is in progress
        if (isLoading || isInitialLoading) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            
            // Clear local state first
            setQuestion("");
            setVisualizationData(null);
            setInitialError(null);

            // Reset on the server
            await client.genAI.aiChatHistory({
                workspaceId: workspace,
                chatHistoryRequest: {
                    threadIdSuffix: dashboardId,
                    reset: true,
                },
            });
            
        } catch (err) {
            console.error("Failed to reset visualization:", err);
            setError("Failed to reset visualization");
        } finally {
            setIsLoading(false);
        }
    }, [client, workspace, dashboardId, isLoading, isInitialLoading]);

    return {
        question,
        setQuestion,
        isLoading,
        isInitialLoading,
        visualizationData,
        handleSubmit,
        handleReset,
        error,
        initialError,
    };
}

const getApiClientDirtyHack = (backend: any): ITigerClient => {
    do {
        if (backend.client) {
            return backend.client;
        }
        backend = backend.decorated;
    } while (backend);

    throw new Error("Failed to retrieve API Client instance");
};
