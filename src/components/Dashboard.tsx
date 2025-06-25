
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cloud, Server, Shield, Database, Activity, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { ServerManager } from "@/utils/serverManager";
import { useAuth } from "@/hooks/useAuth";

interface DeploymentData {
  id: string;
  name: string;
  provider: string;
  status: string;
  resources: number;
  lastUpdate: string;
  progress: number;
  resourceIds?: string[];
}

interface CreatedResource {
  id: string;
  type: string;
  name: string;
  status: string;
  provider: string;
  createdAt: string;
  deploymentId: string;
}

interface DashboardStats {
  activeDeployments: number;
  totalResources: number;
  costThisMonth: number;
  securityScore: number;
  runningDeployments: number;
}

const Dashboard = () => {
  const { awsAuth, isServerRunning } = useAuth();
  const [deployments, setDeployments] = useState<DeploymentData[]>([]);
  const [createdResources, setCreatedResources] = useState<CreatedResource[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    activeDeployments: 0,
    totalResources: 0,
    costThisMonth: 247,
    securityScore: 94,
    runningDeployments: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchRealTimeData = async () => {
    if (!isServerRunning || !awsAuth.isAuthenticated) return;
    
    setIsLoading(true);
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials.accessKey : '';
      
      // Fetch deployments data
      const deploymentsResponse = await fetch(`${backendUrl}/api/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (deploymentsResponse.ok) {
        const deploymentsData = await deploymentsResponse.json();
        setDeployments(deploymentsData.deployments || []);
        
        // Calculate stats from real data
        const activeCount = deploymentsData.deployments?.length || 0;
        const runningCount = deploymentsData.deployments?.filter((d: DeploymentData) => d.status === 'running').length || 0;
        const totalResources = deploymentsData.deployments?.reduce((sum: number, d: DeploymentData) => sum + d.resources, 0) || 0;
        
        setStats(prev => ({
          ...prev,
          activeDeployments: activeCount,
          totalResources,
          runningDeployments: runningCount
        }));
      }

      // Fetch created resources data
      const resourcesResponse = await fetch(`${backendUrl}/api/aws/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json();
        setCreatedResources(resourcesData.resources || []);
        
        // Update total resources count from actual created resources
        setStats(prev => ({
          ...prev,
          totalResources: resourcesData.resources?.length || 0
        }));
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealTimeData();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchRealTimeData, 30000);
    return () => clearInterval(interval);
  }, [isServerRunning, awsAuth.isAuthenticated]);

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
      {/* Real-time status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchRealTimeData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <span className="text-sm text-gray-500">
            Última atualização: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isServerRunning ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {isServerRunning ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Activity className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDeployments}</div>
            <p className="text-xs text-blue-100">{stats.runningDeployments} running</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Server className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResources}</div>
            <p className="text-xs text-green-100">Running across clouds</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost This Month</CardTitle>
            <Database className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.costThisMonth}</div>
            <p className="text-xs text-purple-100">-12% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.securityScore}%</div>
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
            {deployments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum deployment encontrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Faça seu primeiro deployment na seção AWS ou Azure
                </p>
              </div>
            ) : (
              deployments.map((deployment) => (
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
                      {deployment.resourceIds && deployment.resourceIds.length > 0 && (
                        <p className="text-xs text-gray-400">
                          IDs: {deployment.resourceIds.slice(0, 2).join(', ')}
                          {deployment.resourceIds.length > 2 && ` +${deployment.resourceIds.length - 2} more`}
                        </p>
                      )}
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recently Created Resources */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-green-600" />
            <span>Recent Resources Created</span>
          </CardTitle>
          <CardDescription>
            Latest resources created across your cloud infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {createdResources.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">Nenhum recurso criado ainda</p>
                <p className="text-xs text-gray-400 mt-1">
                  Execute um deployment para ver os recursos aqui
                </p>
              </div>
            ) : (
              createdResources
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 8)
                .map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 bg-gradient-to-r ${getProviderColor(resource.provider)} rounded-md flex items-center justify-center`}>
                        <Server className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{resource.name}</p>
                        <p className="text-xs text-gray-500">{resource.provider.toUpperCase()} • {resource.type}</p>
                        <p className="text-xs text-gray-400 font-mono">{resource.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(resource.status)}
                      <div className="text-right">
                        <span className="text-xs text-gray-600 capitalize">{resource.status}</span>
                        <p className="text-xs text-gray-400">
                          {new Date(resource.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
