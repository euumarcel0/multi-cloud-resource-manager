
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Download, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  deployment: string;
  userId: string;
}

const DeploymentLogs = () => {
  const { awsAuth } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadUserLogs = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) return;
    
    setIsLoading(true);
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      const response = await fetch(`${backendUrl}/api/aws/logs/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) return;
    
    try {
      const backendUrl = ServerManager.getBackendUrl();
      const userId = awsAuth.credentials.accessKey;
      
      const response = await fetch(`${backendUrl}/api/aws/logs/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setLogs([]);
      }
    } catch (error) {
      console.error("Erro ao limpar logs:", error);
    }
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level} - ${log.deployment}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadUserLogs();
    
    // Auto-refresh logs every 10 seconds
    const interval = setInterval(loadUserLogs, 10000);
    return () => clearInterval(interval);
  }, [awsAuth.isAuthenticated]);

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
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
    return deployment.toLowerCase().includes("aws") 
      ? "bg-orange-100 text-orange-700" 
      : "bg-blue-100 text-blue-700";
  };

  const getLogStats = () => {
    const total = logs.length;
    const successful = logs.filter(log => log.level.toUpperCase() === 'SUCCESS').length;
    const errors = logs.filter(log => log.level.toUpperCase() === 'ERROR').length;
    const warnings = logs.filter(log => log.level.toUpperCase() === 'WARNING').length;
    
    return { total, successful, errors, warnings };
  };

  const stats = getLogStats();

  if (!awsAuth.isAuthenticated) {
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
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Activity className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">Acesso Restrito</h3>
              <p className="text-gray-600 max-w-md">
                Você precisa fazer login na AWS para visualizar seus logs de deployment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Button variant="outline" size="sm" onClick={loadUserLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} disabled={logs.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Real-time Deployment Logs</CardTitle>
          <CardDescription>
            Live updates from your Terraform deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum log encontrado</p>
                <p className="text-sm">Os logs aparecerão aqui após executar deployments</p>
              </div>
            ) : (
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
                        {log.level.toUpperCase()}
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
            )}
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
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
                <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
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
                <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
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
                <p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p>
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
