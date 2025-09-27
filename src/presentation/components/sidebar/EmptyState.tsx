import React from "react";
import { MessageSquare, Plus, Info } from "lucide-react";

const EmptyState: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <MessageSquare
              size={32}
              className="text-blue-600 dark:text-blue-400"
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Managed Claude Tabs
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Create your first Claude tab to get started. Only tabs created
            through this sidebar will be managed and available in the popup.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info
              size={16}
              className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
            />
            <div className="text-left">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                How it works
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Click "New Claude Tab" to create a managed tab</li>
                <li>• Use the dropdown to select a Firefox container</li>
                <li>• Only managed tabs appear in the popup extension</li>
                <li>• Send prompts to managed tabs from the popup</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Plus size={16} />
          <span>Click the button above to create your first managed tab</span>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
