import React from "react";
import { MessageSquare, Settings, Users, Activity } from "lucide-react";

const TabManager: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <MessageSquare size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Claude Assistant
            </h1>
          </div>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Advanced tab management for your Claude.ai workflow with Firefox
            container support
          </p>
        </div>

        {/* Welcome Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Welcome to Tab Manager
              </h2>
              <p className="text-text-secondary text-lg">
                Your central hub for managing Claude.ai tabs across multiple
                Firefox containers
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Container Groups */}
              <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Container Groups
                </h3>
                <p className="text-sm text-text-secondary">
                  Automatically organize tabs by Firefox container. Each
                  container gets its own group for isolated Claude sessions.
                </p>
              </div>

              {/* Custom Groups */}
              <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Custom Groups
                </h3>
                <p className="text-sm text-text-secondary">
                  Create your own groups to organize tabs by project, topic, or
                  any criteria you choose.
                </p>
              </div>

              {/* Active Monitoring */}
              <div className="text-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Activity size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Active Monitoring
                </h3>
                <p className="text-sm text-text-secondary">
                  Real-time tracking of active tabs with automatic restoration
                  after browser restarts.
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Getting Started
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Open the Sidebar
                  </h4>
                  <p className="text-text-secondary">
                    Press{" "}
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      F1
                    </kbd>{" "}
                    or go to View → Sidebar → Claude Assistant to open the
                    sidebar panel.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Create Claude Tabs
                  </h4>
                  <p className="text-text-secondary">
                    Use the "New Claude Tab" button to create tabs in different
                    Firefox containers. Each container maintains separate
                    cookies and sessions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Organize with Groups
                  </h4>
                  <p className="text-text-secondary">
                    Container groups are created automatically. Create custom
                    groups for project-based organization that can span multiple
                    containers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Use the Popup
                  </h4>
                  <p className="text-text-secondary">
                    Click the extension icon to quickly send prompts to any
                    managed Claude tab and view recent responses.
                  </p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                💡 Pro Tips
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                <li>
                  • Each Firefox container maintains separate Claude sessions
                </li>
                <li>• Tabs are automatically restored if Firefox crashes</li>
                <li>• Use expand/collapse to organize your workspace</li>
                <li>
                  • Custom groups help organize tabs by project or workflow
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabManager;
