import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Kanban } from "lucide-react";
import { useDeals, usePipelines, useUpdateDeal } from "@/hooks/useDeals";
import { formatCurrency, cn, timeAgo } from "@/lib/utils";
import DealForm from "@/components/deals/DealForm";

export default function PipelinePage() {
  const { data: pipelines } = usePipelines();
  const defaultPipeline = pipelines?.find(p => p.is_default) || pipelines?.[0];
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>();
  const pipelineId = selectedPipelineId || defaultPipeline?.id;
  const { data: deals, isLoading } = useDeals({ pipeline_id: pipelineId, status: "open" });
  const updateDeal = useUpdateDeal();
  const navigate = useNavigate();
  const [showDealForm, setShowDealForm] = useState(false);

  const currentPipeline = pipelines?.find(p => p.id === pipelineId);
  const stages = currentPipeline?.stages || [];

  const handleStageDrop = async (dealId: string, newStageId: string) => {
    const stage = stages.find(s => s.id === newStageId);
    await updateDeal.mutateAsync({
      id: dealId,
      stage_id: newStageId,
      stage_entered_at: new Date().toISOString(),
      probability: stage?.probability || 0,
      status: stage?.is_won ? "won" : stage?.is_lost ? "lost" : "open",
    } as any);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">צנרת מכירות</h1>
          <p className="text-muted-foreground text-sm">
            {deals?.length || 0} עסקאות פתוחות
            {deals && deals.length > 0 && (
              <> | {formatCurrency(deals.reduce((sum, d) => sum + (d.value || 0), 0))}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pipelines && pipelines.length > 1 && (
            <select
              value={pipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowDealForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            עסקה חדשה
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : stages.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {stages.map(stage => {
            const stageDeals = deals?.filter(d => d.stage_id === stage.id) || [];
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const dealId = e.dataTransfer.getData("dealId");
                  if (dealId) handleStageDrop(dealId, stage.id);
                }}
              >
                {/* Stage header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stage.color || "#6366f1" }}
                  />
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stageDeals.length}
                  </span>
                  <span className="text-xs text-muted-foreground mr-auto">
                    {formatCurrency(stageValue)}
                  </span>
                </div>

                {/* Deal cards */}
                <div className="space-y-2 flex-1">
                  {stageDeals.map(deal => {
                    const daysInStage = Math.floor(
                      (Date.now() - new Date(deal.stage_entered_at).getTime()) / 86400000
                    );

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("dealId", deal.id)}
                        onClick={() => navigate(`/pipeline/${deal.id}`)}
                        className="p-3 bg-card border border-border rounded-lg hover:shadow-md cursor-pointer transition-all"
                      >
                        <p className="font-medium text-sm">{deal.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {deal.contact?.first_name} {deal.contact?.last_name}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-primary">
                            {formatCurrency(deal.value)}
                          </span>
                          <span className={cn(
                            "text-xs",
                            daysInStage > 14 ? "text-destructive" :
                            daysInStage > 7 ? "text-warning" : "text-muted-foreground"
                          )}>
                            {daysInStage} ימים
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Kanban size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium mb-1">אין צנרת מכירות</p>
            <p className="text-sm">צור צנרת מכירות בהגדרות</p>
          </div>
        </div>
      )}

      {showDealForm && (
        <DealForm onClose={() => setShowDealForm(false)} />
      )}
    </div>
  );
}
