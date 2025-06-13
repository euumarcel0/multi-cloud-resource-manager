
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Download, Trash2, RefreshCw } from "lucide-react";

const DeploymentLogs = () => {
  const [logs] = useState([
    {
      id: 1,
      timestamp: "2024-01-15 14:30:25",
      level: "INFO",
      message: "Terraform initialization started",
      deployment: "AWS Production"
    },
    {
      id: 2,
      timestamp: "2024-01-15 14:30:26",
      level: "INFO",
      message: "Downloading provider hashicorp/aws v5.42.0",
      deployment: "AWS Production"
    },
    {
      id: 3,
      timestamp: "2024-01-15 14:30:28",
      level: "INFO",
      message: "Creating VPC with CIDR 10.0.0.0/16",
      deployment: "AWS Production"
    },
    {
      id: 4,
      timestamp: "2024-01-15 14:30:32",
      level: "SUCCESS",
      message: "VPC created successfully: vpc-12345",
      deployment: "AWS Production"
    },
    {
      id: 5,
      timestamp: "2024-01-15 14:30:35",
      level: "INFO",
      message: "Creating public subnet 10.0.1.0/24",
      deployment: "AWS Production"
    },
    {
      id: 6,
      timestamp: "2024-01-15 14:30:38",
      level: "SUCCESS",
      message: "Subnet created successfully: subnet-67890",
      deployment: "AWS Production"
    },
    {
      id: 7,
      timestamp: "2024-01-15 14:35:15",
      level: "INFO",
      message: "Starting Azure resource group creation",
      deployment: "Azure Development"
    },
    {
      id: 8,
      timestamp: "2024-01-15 14:35:18",
      level: "SUCCESS",
      message: "Resource group 'rg-dev' created in East US",
      deployment: "Azure Development"
    },
    {
      id: 9,
      timestamp: "2024-01-15 14:35:22",
      level: "ERROR",
      message: "Failed to create virtual machine: Quota exceeded",
      deployment: "Azure Development"
    },
    {
      id: 10,
      timestamp: "2024-01-15 14:35:25",
      level: "INFO",
      message: "Retrying virtual machine creation...",
      deployment: "Azure Development"
    }
  ]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "SUCCESS":
        return "bg-green-100 text-green-700";
      case "ERROR":
        return "bg-red-100 text-red-700";
      case "WARNING":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getDeploymentColor = (deployment: string) => {
    return deployment.includes("AWS") 
      ? "bg-orange-100 text-orange-700" 
      : "bg-blue-100 text-blue-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <Activity className="h-8 w-8 text-gray-700" />
            <span>Deployment Logs</span>
          </h2>
          <p className="text-gray-600 mt-1">Monitor your infrastructure deployment progress</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Real-time Deployment Logs</CardTitle>
          <CardDescription>
            Live updates from your Terraform deployments across AWS and Azure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <Badge
                      variant="secondary"
                      className={getLevelColor(log.level)}
                    >
                      {log.level}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getDeploymentColor(log.deployment)}
                    >
                      {log.deployment}
                    </Badge>
                    <span className="text-sm text-gray-500 font-mono">
                      {log.timestamp}
                    </span>
                  </div>
                  <div className="flex-1 px-4">
                    <p className="text-sm text-gray-900 font-mono">
                      {log.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Log Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900">1,247</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Successful</p>
                <p className="text-2xl font-bold text-green-600">1,156</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Errors</p>
                <p className="text-2xl font-bold text-red-600">23</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-bold">✗</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">68</p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 font-bold">!</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeploymentLogs;
