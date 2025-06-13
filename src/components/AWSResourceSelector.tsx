
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Server, Play, RotateCcw, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SelectedResources {
  vpc: boolean;
  subnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  loadBalancer: boolean;
  internetGateway: boolean;
}

const AWSResourceSelector = () => {
  const { toast } = useToast();
  const { awsAuth } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    subnet: false,
    securityGroup: false,
    ec2: false,
    loadBalancer: false,
    internetGateway: false
  });

  const [config, setConfig] = useState({
    region: (awsAuth.credentials && 'region' in awsAuth.credentials) ? awsAuth.credentials.region : "us-east-1",
    vpcName: "vpc-production",
    vpcCidr: "10.0.0.0/16",
    subnetName: "public-subnet",
    subnetCidr: "10.0.1.0/24",
    instanceType: "t2.micro",
    keyPair: "my-keypair",
    sgName: "web-security-group"
  });

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  const handleDeploy = async () => {
    if (!awsAuth.isAuthenticated) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa fazer login na AWS primeiro.",
        variant: "destructive"
      });
      return;
    }

    const selectedCount = Object.values(selectedResources).filter(Boolean).length;
    if (selectedCount === 0) {
      toast({
        title: "Nenhum Recurso Selecionado",
        description: "Selecione pelo menos um recurso para criar.",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    toast({
      title: "Deployment Iniciado",
      description: `Criando ${selectedCount} recurso(s) AWS selecionado(s).`,
    });
    
    console.log("Deploying resources:", selectedResources, config);
    
    setTimeout(() => {
      setIsDeploying(false);
      toast({
        title: "Deployment Completo",
        description: "Recursos AWS foram criados com sucesso.",
      });
    }, 3000);
  };

  const generateTerraformCode = () => {
    const awsCredentials = awsAuth.credentials && 'accessKey' in awsAuth.credentials ? awsAuth.credentials : null;
    
    let terraformCode = `terraform {
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
  access_key = "${awsCredentials?.accessKey || ''}"
  secret_key = "${awsCredentials?.secretKey || ''}"
  ${awsCredentials?.token ? `token = "${awsCredentials.token}"` : ''}
}

`;

    if (selectedResources.vpc) {
      terraformCode += `resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}

`;
    }

    if (selectedResources.internetGateway && selectedResources.vpc) {
      terraformCode += `resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "main-igw"
  }
}

`;
    }

    if (selectedResources.subnet && selectedResources.vpc) {
      terraformCode += `resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}

`;
    }

    if (selectedResources.securityGroup && selectedResources.vpc) {
      terraformCode += `resource "aws_security_group" "web" {
  name        = "${config.sgName}"
  description = "Security group for web servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${config.sgName}"
  }
}

`;
    }

    if (selectedResources.ec2) {
      terraformCode += `resource "aws_instance" "web" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "${config.instanceType}"
  key_name      = "${config.keyPair}"
  ${selectedResources.subnet ? 'subnet_id     = aws_subnet.public.id' : ''}
  ${selectedResources.securityGroup ? 'vpc_security_group_ids = [aws_security_group.web.id]' : ''}
  
  tags = {
    Name = "web-server"
  }
}

`;
    }

    return terraformCode;
  };

  const resourcesList = [
    { key: 'vpc' as keyof SelectedResources, name: 'VPC', description: 'Virtual Private Cloud' },
    { key: 'internetGateway' as keyof SelectedResources, name: 'Internet Gateway', description: 'Conecta VPC à internet' },
    { key: 'subnet' as keyof SelectedResources, name: 'Subnet', description: 'Sub-rede dentro da VPC' },
    { key: 'securityGroup' as keyof SelectedResources, name: 'Security Group', description: 'Firewall virtual' },
    { key: 'ec2' as keyof SelectedResources, name: 'EC2 Instance', description: 'Máquina virtual' },
    { key: 'loadBalancer' as keyof SelectedResources, name: 'Load Balancer', description: 'Distribuidor de carga' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span>AWS Resources</span>
          </h2>
          <p className="text-gray-600 mt-1">Selecione e configure os recursos AWS que deseja criar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Seleção de Recursos</CardTitle>
            <CardDescription>
              Escolha quais recursos AWS você deseja criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resourcesList.map((resource) => (
              <div key={resource.key} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={resource.key}
                  checked={selectedResources[resource.key]}
                  onCheckedChange={(checked) => handleResourceChange(resource.key, checked as boolean)}
                />
                <div className="flex-1">
                  <Label htmlFor={resource.key} className="text-sm font-medium">
                    {resource.name}
                  </Label>
                  <p className="text-xs text-gray-500">{resource.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Configure os parâmetros dos recursos selecionados
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
                  disabled={!selectedResources.ec2}
                />
              </div>
            </div>
            
            {selectedResources.vpc && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Configuração VPC</h4>
                <div>
                  <Label htmlFor="vpcName">Nome da VPC</Label>
                  <Input
                    id="vpcName"
                    value={config.vpcName}
                    onChange={(e) => setConfig({ ...config, vpcName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vpcCidr">CIDR Block</Label>
                  <Input
                    id="vpcCidr"
                    value={config.vpcCidr}
                    onChange={(e) => setConfig({ ...config, vpcCidr: e.target.value })}
                  />
                </div>
              </div>
            )}

            {selectedResources.subnet && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Configuração Subnet</h4>
                <div>
                  <Label htmlFor="subnetName">Nome da Subnet</Label>
                  <Input
                    id="subnetName"
                    value={config.subnetName}
                    onChange={(e) => setConfig({ ...config, subnetName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="subnetCidr">CIDR Block</Label>
                  <Input
                    id="subnetCidr"
                    value={config.subnetCidr}
                    onChange={(e) => setConfig({ ...config, subnetCidr: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleDeploy} 
                disabled={isDeploying}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isDeploying ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Criar Recursos
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTerraform(!showTerraform)}
              >
                {showTerraform ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showTerraform ? 'Ocultar' : 'Ver'} Terraform
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terraform Code Preview */}
      {showTerraform && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Código Terraform Gerado</CardTitle>
            <CardDescription>
              Código que será executado baseado na sua seleção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {generateTerraformCode()}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Resources Summary */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Recursos Selecionados</CardTitle>
          <CardDescription>
            Resumo dos recursos que serão criados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedResources).map(([key, selected]) => {
              if (!selected) return null;
              const resource = resourcesList.find(r => r.key === key);
              return (
                <Badge key={key} className="bg-orange-100 text-orange-700">
                  {resource?.name}
                </Badge>
              );
            })}
            {Object.values(selectedResources).every(v => !v) && (
              <p className="text-gray-500 text-sm">Nenhum recurso selecionado</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AWSResourceSelector;
