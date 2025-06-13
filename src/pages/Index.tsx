
import { useState } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import AWSDeployment from "@/components/AWSDeployment";
import AWSResourceSelector from "@/components/AWSResourceSelector";
import AzureDeployment from "@/components/AzureDeployment";
import DeploymentLogs from "@/components/DeploymentLogs";
import AWSLogin from "@/components/AWSLogin";
import AzureLogin from "@/components/AzureLogin";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleLoginSuccess = () => {
    setActiveTab("dashboard");
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Cloud Infrastructure Manager
              </h1>
              <p className="text-xl text-gray-600">
                Deploy and manage your AWS and Azure resources with Terraform
              </p>
            </header>

            <div className="space-y-6">
              {activeTab === "dashboard" && <Dashboard />}
              {activeTab === "aws" && <AWSDeployment />}
              {activeTab === "aws-resources" && <AWSResourceSelector />}
              {activeTab === "azure" && <AzureDeployment />}
              {activeTab === "logs" && <DeploymentLogs />}
              {activeTab === "aws-login" && <AWSLogin onLoginSuccess={handleLoginSuccess} />}
              {activeTab === "azure-login" && <AzureLogin onLoginSuccess={handleLoginSuccess} />}
            </div>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
};

export default Index;
