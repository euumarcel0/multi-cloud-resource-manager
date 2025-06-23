
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cloud, Server, Shield, Database, Activity, CheckCircle, XCircle, Clock } from "lucide-react";

const Dashboard = () => {
  const [deployments] = useState([
    {
      id: 1,
      name: "AWS Production Environment",
      provider: "aws",
      status: "running",
      resources: 12,
      lastUpdate: "2 hours ago",
      progress: 100
    },
    {
      id: 2,
      name: "Azure Development Environment",
      provider: "azure",
      status: "deploying",
      resources: 8,
      lastUpdate: "5 minutes ago",
      progress: 75
    },
    {
      id: 3,
      name: "AWS Load Balancer Setup",
      provider: "aws",
      status: "failed",
      resources: 5,
      lastUpdate: "1 day ago",
      progress: 60
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "deploying":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getProviderColor = (provider: string) => {
    return provider === "aws" ? "from-orange-500 to-orange-600" : "from-blue-500 to-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Activity className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-blue-100">2 AWS, 1 Azure</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Server className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25</div>
            <p className="text-xs text-green-100">Running across clouds</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost This Month</CardTitle>
            <Database className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$247</div>
            <p className="text-xs text-purple-100">-12% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-orange-100">Excellent security posture</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deployments */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span>Recent Deployments</span>
          </CardTitle>
          <CardDescription>
            Monitor your infrastructure deployments across AWS and Azure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 bg-gradient-to-r ${getProviderColor(deployment.provider)} rounded-lg flex items-center justify-center`}>
                    {deployment.provider === "aws" ? (
                      <Server className="h-5 w-5 text-white" />
                    ) : (
                      <Cloud className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{deployment.name}</h3>
                    <p className="text-sm text-gray-500">
                      {deployment.resources} resources • {deployment.lastUpdate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(deployment.status)}
                      <span className="text-sm font-medium capitalize">
                        {deployment.status}
                      </span>
                    </div>
                    {deployment.status === "deploying" && (
                      <Progress value={deployment.progress} className="w-20 mt-1" />
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
