import { Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LLMKeyManager } from "../llm/LLMKeyManager";
import { McpServerManager } from "../mcp/McpServerManager";
import { BranchUpdater } from "./BranchUpdater";
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
    <Card
      className="w-full bg-neutral-900 text-neutral-100 border-neutral-800 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
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
            className="text-neutral-400 hover:text-white hover:bg-neutral-800"
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
                      ? "bg-neutral-800 text-white font-medium"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <Separator orientation="vertical" className="bg-neutral-800" />

          {/* Content */}
          <div className="flex-1 min-h-[500px] max-h-[70vh] overflow-y-auto pr-2">
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

  // Lock body scroll when settings modal is open
  useEffect(() => {
    if (showSettings) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";

      return () => {
        // Restore scroll position when modal closes
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [showSettings]);

  const handleClose = () => {
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={(e) => {
          // Close when clicking the backdrop
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="w-full max-w-4xl my-auto">
          <SettingsPanel onClose={handleClose} />
        </div>
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
