
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cloud, Play, Square, RotateCcw, Upload, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const AzureDeployment = () => {
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [config, setConfig] = useState({
    location: "East US",
    resourceGroup: "rg-production",
    vmSize: "Standard_DS1_v2",
    adminUsername: "azureuser"
  });

  const handleDeploy = async () => {
    setIsDeploying(true);
    toast({
      title: "Deployment Started",
      description: "Azure infrastructure deployment has been initiated.",
    });
    
    // Simulate deployment process
    setTimeout(() => {
      setIsDeploying(false);
      toast({
        title: "Deployment Complete",
        description: "Azure resources have been successfully deployed.",
      });
    }, 5000);
  };

  const terraformTemplate = `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "${config.resourceGroup}"
  location = "${config.location}"
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-main"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_subnet" "internal" {
  name                 = "internal"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/24"]
}

resource "azurerm_linux_virtual_machine" "main" {
  name                = "vm-main"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "${config.vmSize}"
  admin_username      = "${config.adminUsername}"
  
  disable_password_authentication = false
  admin_password = "Password1234!"
}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span>Azure Deployment</span>
          </h2>
          <p className="text-gray-600 mt-1">Configure and deploy your Azure infrastructure</p>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          Provider: Azure
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Infrastructure Configuration</CardTitle>
            <CardDescription>
              Configure your Azure resources before deployment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Azure Region</Label>
                <Input
                  id="location"
                  value={config.location}
                  onChange={(e) => setConfig({ ...config, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vmSize">VM Size</Label>
                <Input
                  id="vmSize"
                  value={config.vmSize}
                  onChange={(e) => setConfig({ ...config, vmSize: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="resourceGroup">Resource Group</Label>
              <Input
                id="resourceGroup"
                value={config.resourceGroup}
                onChange={(e) => setConfig({ ...config, resourceGroup: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="adminUsername">Admin Username</Label>
              <Input
                id="adminUsername"
                value={config.adminUsername}
                onChange={(e) => setConfig({ ...config, adminUsername: e.target.value })}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleDeploy} 
                disabled={isDeploying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isDeploying ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Deploy Infrastructure
                  </>
                )}
              </Button>
              <Button variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Terraform Code Preview */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Generated Terraform Code</CardTitle>
            <CardDescription>
              Preview and customize your infrastructure as code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {terraformTemplate}
              </pre>
            </div>
            <div className="flex space-x-2 mt-4">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload .tf File
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Azure Resources Status</CardTitle>
          <CardDescription>
            Current status of your deployed Azure resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Resource Group", status: "running", id: "rg-production" },
              { name: "Virtual Network", status: "running", id: "vnet-main" },
              { name: "Virtual Machine", status: "running", id: "vm-linux-01" },
              { name: "Load Balancer", status: "running", id: "lb-main" },
              { name: "Storage Account", status: "pending", id: "stmainprod001" },
              { name: "Network Security Group", status: "running", id: "nsg-main" }
            ].map((resource) => (
              <div
                key={resource.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{resource.name}</h3>
                  <Badge
                    variant={resource.status === "running" ? "default" : "secondary"}
                    className={resource.status === "running" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}
                  >
                    {resource.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">{resource.id}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AzureDeployment;
