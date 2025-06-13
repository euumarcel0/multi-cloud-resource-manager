
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Server, Play, Square, RotateCcw, Upload, Download, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [config, setConfig] = useState({
    region: awsAuth.credentials?.region || "us-east-1",
    vpcName: "vpc-production",
    instanceType: "t2.micro",
    keyPair: "my-keypair"
  });

  const handleDeploy = async () => {
    if (!awsAuth.isAuthenticated) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa fazer login na AWS primeiro.",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    toast({
      title: "Deployment Started",
      description: "AWS infrastructure deployment has been initiated.",
    });
    
    // Aqui você enviaria as credenciais e configuração para sua API
    console.log("Deploying with credentials:", {
      credentials: awsAuth.credentials,
      config
    });
    
    // Simulate deployment process
    setTimeout(() => {
      setIsDeploying(false);
      toast({
        title: "Deployment Complete",
        description: "AWS resources have been successfully deployed.",
      });
    }, 5000);
  };

  if (!awsAuth.isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
              <span>AWS Deployment</span>
            </h2>
            <p className="text-gray-600 mt-1">Configure and deploy your AWS infrastructure</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">Autenticação Necessária</h3>
              <p className="text-gray-600 max-w-md">
                Você precisa fazer login na AWS com suas credenciais para acessar os recursos de deployment.
              </p>
              <p className="text-sm text-gray-500">
                Clique no botão de login AWS na barra lateral para continuar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const terraformTemplate = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region     = "${config.region}"
  access_key = "${awsAuth.credentials?.accessKey}"
  secret_key = "${awsAuth.credentials?.secretKey}"
  ${awsAuth.credentials?.token ? `token = "${awsAuth.credentials.token}"` : ''}
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "${config.vpcName}"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  tags = {
    Name = "public-subnet"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "${config.instanceType}"
  key_name      = "${config.keyPair}"
  subnet_id     = aws_subnet.public.id
  
  tags = {
    Name = "web-server"
  }
}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span>AWS Deployment</span>
          </h2>
          <p className="text-gray-600 mt-1">Configure and deploy your AWS infrastructure</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Autenticado
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            Provider: AWS
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Infrastructure Configuration</CardTitle>
            <CardDescription>
              Configure your AWS resources before deployment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">AWS Region</Label>
                <Input
                  id="region"
                  value={config.region}
                  onChange={(e) => setConfig({ ...config, region: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instanceType">Instance Type</Label>
                <Input
                  id="instanceType"
                  value={config.instanceType}
                  onChange={(e) => setConfig({ ...config, instanceType: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="vpcName">VPC Name</Label>
              <Input
                id="vpcName"
                value={config.vpcName}
                onChange={(e) => setConfig({ ...config, vpcName: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="keyPair">Key Pair Name</Label>
              <Input
                id="keyPair"
                value={config.keyPair}
                onChange={(e) => setConfig({ ...config, keyPair: e.target.value })}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleDeploy} 
                disabled={isDeploying}
                className="bg-orange-600 hover:bg-orange-700"
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
          <CardTitle>AWS Resources Status</CardTitle>
          <CardDescription>
            Current status of your deployed AWS resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "VPC", status: "running", id: "vpc-12345" },
              { name: "EC2 Instance", status: "running", id: "i-abcdef123" },
              { name: "Security Group", status: "running", id: "sg-67890" },
              { name: "Internet Gateway", status: "running", id: "igw-xyz789" },
              { name: "Load Balancer", status: "pending", id: "lb-456def" },
              { name: "Route Table", status: "running", id: "rtb-123abc" }
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

export default AWSDeployment;
