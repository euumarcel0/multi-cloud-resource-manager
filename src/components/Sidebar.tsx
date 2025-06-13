
import { Cloud, Server, Database, Activity, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "aws", label: "AWS Deployment", icon: Server },
    { id: "azure", label: "Azure Deployment", icon: Cloud },
    { id: "logs", label: "Deployment Logs", icon: Activity },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-lg z-50">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">TerraformAPI</span>
        </div>
      </div>
      
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors",
              activeTab === item.id
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
