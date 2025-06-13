
import { Cloud, Server, Database, Activity, Settings, Home, LogIn, LogOut, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const { awsAuth, azureAuth, logout } = useAuth();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "aws", label: "AWS Deployment", icon: Server },
    { id: "aws-resources", label: "AWS Resources", icon: Boxes },
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

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">AWS</span>
            {awsAuth.isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout('aws')}
                  className="h-6 px-2"
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('aws-login')}
                className="h-6 px-2"
              >
                <LogIn className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Azure</span>
            {azureAuth.isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout('azure')}
                  className="h-6 px-2"
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('azure-login')}
                className="h-6 px-2"
              >
                <LogIn className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
