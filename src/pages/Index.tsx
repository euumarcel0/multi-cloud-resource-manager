
import { useState } from "react";
import { Cloud, Server, Database, Shield, Activity, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import AWSDeployment from "@/components/AWSDeployment";
import AzureDeployment from "@/components/AzureDeployment";
import DeploymentLogs from "@/components/DeploymentLogs";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
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
            {activeTab === "azure" && <AzureDeployment />}
            {activeTab === "logs" && <DeploymentLogs />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
