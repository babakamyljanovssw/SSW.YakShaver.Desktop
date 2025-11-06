import { useState } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BranchUpdater } from "./BranchUpdater";
import { LLMKeyManager } from "../llm/LLMKeyManager";
import { McpServerManager } from "../mcp/McpServerManager";
import { CustomPromptManager } from "./CustomPromptManager";

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsTab = "branch-updater" | "llm" | "mcp" | "custom-prompts";

export const SettingsPanel = ({ onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("branch-updater");

  const tabs = [
    { id: "branch-updater" as const, label: "Branch & Updates" },
    { id: "llm" as const, label: "LLM Settings" },
    { id: "mcp" as const, label: "MCP Servers" },
    { id: "custom-prompts" as const, label: "Custom Prompts" },
  ];

  return (
    <Card className="w-full max-w-4xl bg-black/20 backdrop-blur-sm border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-white" />
            <CardTitle className="text-white text-2xl font-medium">Settings</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <Separator orientation="vertical" className="bg-white/10" />

          {/* Content */}
          <div className="flex-1 min-h-[500px] max-h-[600px] overflow-y-auto">
            {activeTab === "branch-updater" && <BranchUpdater />}
            {activeTab === "llm" && <LLMKeyManager />}
            {activeTab === "mcp" && <McpServerManager />}
            {activeTab === "custom-prompts" && <CustomPromptManager />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Settings button component to be used in the header or anywhere in the app
export const SettingsButton = () => {
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <SettingsPanel onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowSettings(true)}
      variant="outline"
      size="sm"
      className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
    >
      <SettingsIcon className="size-4 mr-2" />
      Settings
    </Button>
  );
};

