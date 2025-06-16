const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Configure CORS to allow requests from the frontend
app.use(cors({
    origin: ['http://localhost:3000', 'https://07f4b861-def3-4f19-bf23-790e3ad55fc4.lovableproject.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Backend server is running', timestamp: new Date().toISOString() });
});

// In a real application, securely store and retrieve credentials
const awsCredentialsStore = {};
const azureCredentialsStore = {};

// Endpoint para armazenar credenciais AWS temporariamente (em produção, usar solução segura)
app.post('/api/aws/credentials', (req, res) => {
    console.log('Recebendo credenciais AWS...');
    const { userId, credentials } = req.body;
    
    if (!userId || !credentials) {
        console.error('Dados faltando:', { userId: !!userId, credentials: !!credentials });
        return res.status(400).json({ message: 'userId e credentials são obrigatórios' });
    }
    
    awsCredentialsStore[userId] = credentials;
    console.log('Credenciais AWS armazenadas para userId:', userId);
    res.json({ message: 'Credentials stored successfully' });
});

app.post('/api/aws/deploy', async (req, res) => {
    console.log('Iniciando deployment AWS...');
    const { resources, config, auth } = req.body;

    if (!auth || !awsCredentialsStore[auth.userId]) {
        console.error('Autenticação falhou:', { auth: !!auth, credentials: !!awsCredentialsStore[auth?.userId] });
        return res.status(401).json({ message: 'Authentication required or credentials not found.' });
    }

    const awsAuthCredentials = awsCredentialsStore[auth.userId];
    console.log('Credenciais encontradas, gerando Terraform...');

    // Generate Terraform .tf file content dynamically based on selected resources
    const terraformCode = generateTerraformCodeAWS(resources, config, awsAuthCredentials);
    const tfFilePath = path.join(__dirname, 'temp', 'aws_deployment.tf');
    const tfVarsFilePath = path.join(__dirname, 'temp', 'terraform.tfvars');

    try {
        if (!fs.existsSync(path.join(__dirname, 'temp'))){
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        
        fs.writeFileSync(tfFilePath, terraformCode);
        console.log('Arquivo .tf criado:', tfFilePath);
        
        // Write sensitive data to .tfvars
        let tfVarsContent = `access_key = "${awsAuthCredentials.accessKey}"\nsecret_key = "${awsAuthCredentials.secretKey}"\nregion = "${awsAuthCredentials.region}"`;
        if (awsAuthCredentials.token) {
            tfVarsContent += `\ntoken = "${awsAuthCredentials.token}"`;
        }
        fs.writeFileSync(tfVarsFilePath, tfVarsContent);
        console.log('Arquivo .tfvars criado:', tfVarsFilePath);

        // Set response headers for streaming
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        const logs = [];
        
        // Send initial message
        res.write(JSON.stringify({ type: 'log', message: 'Iniciando Terraform init...\n' }));

        const terraformInit = spawn('terraform', ['init'], { cwd: path.join(__dirname, 'temp') });

        terraformInit.stdout.on('data', (data) => {
            const message = data.toString();
            logs.push(message);
            res.write(JSON.stringify({ type: 'log', message: message }));
        });

        terraformInit.stderr.on('data', (data) => {
            const message = `ERROR: ${data.toString()}`;
            logs.push(message);
            res.write(JSON.stringify({ type: 'log', message: message }));
        });

        terraformInit.on('close', async (code) => {
            if (code !== 0) {
                console.error('Terraform init falhou com código:', code);
                res.write(JSON.stringify({ type: 'error', message: 'Terraform init failed.' }));
                return res.end();
            }

            console.log('Terraform init concluído, iniciando apply...');
            res.write(JSON.stringify({ type: 'log', message: '\nTerraform init concluído. Iniciando apply --auto-approve...\n' }));

            const terraformApply = spawn('terraform', ['apply', '-auto-approve', `-var-file=${tfVarsFilePath}`], { cwd: path.join(__dirname, 'temp') });

            terraformApply.stdout.on('data', (data) => {
                const message = data.toString();
                logs.push(message);
                res.write(JSON.stringify({ type: 'log', message: message }));
            });

            terraformApply.stderr.on('data', (data) => {
                const message = `ERROR: ${data.toString()}`;
                logs.push(message);
                res.write(JSON.stringify({ type: 'log', message: message }));
            });

            terraformApply.on('close', (applyCode) => {
                if (applyCode !== 0) {
                    console.error('Terraform apply falhou com código:', applyCode);
                    res.write(JSON.stringify({ type: 'error', message: 'Terraform apply failed.' }));
                } else {
                    console.log('Terraform apply concluído com sucesso!');
                    res.write(JSON.stringify({ type: 'success', message: 'Deployment complete!' }));
                }
                
                // Clean up files
                try {
                    fs.unlinkSync(tfFilePath);
                    fs.unlinkSync(tfVarsFilePath);
                    console.log('Arquivos temporários limpos');
                } catch (err) {
                    console.error('Error cleaning up files:', err);
                }
                
                res.end();
            });
        });

    } catch (error) {
        console.error("Backend error:", error);
        res.status(500).json({ message: 'Internal server error during deployment.' });
    }
});

// Function to generate AWS Terraform code based on selected resources and config
const generateTerraformCodeAWS = (resources, config, authCredentials) => {
    let code = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region = var.region
  access_key = var.access_key
  secret_key = var.secret_key
${authCredentials.token ? '  token = var.token' : ''}
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "access_key" {
  description = "AWS Access Key"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "AWS Secret Key"
  type        = string
  sensitive   = true
}

${authCredentials.token ? `variable "token" {
  description = "AWS Session Token"
  type        = string
  sensitive   = true
}` : ''}

`;

    // Only generate code for selected resources
    if (resources.vpc) {
        code += `
resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}
`;
    }

    if (resources.internetGateway) {
        code += `
resource "aws_internet_gateway" "main" {
  vpc_id = ${resources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  tags = {
    Name = "main-igw"
  }
}
`;
    }

    if (resources.subnet) {
        code += `
resource "aws_subnet" "public" {
  vpc_id     = ${resources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}
`;
    }

    if (resources.securityGroup) {
        code += `
resource "aws_security_group" "web" {
  name        = "${config.sgName}"
  description = "Security group for web servers"
  vpc_id      = ${resources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}

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

    if (resources.ec2) {
        let subnetRef = '';
        if (resources.subnet) {
            subnetRef = 'subnet_id     = aws_subnet.public.id';
        } else if (config.existingSubnetId) {
            subnetRef = `subnet_id     = "${config.existingSubnetId}"`;
        }

        let securityGroupRef = '';
        if (resources.securityGroup) {
            securityGroupRef = 'vpc_security_group_ids = [aws_security_group.web.id]';
        } else if (config.existingSecurityGroupId) {
            securityGroupRef = `vpc_security_group_ids = ["${config.existingSecurityGroupId}"]`;
        }

        code += `
resource "aws_instance" "web" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "${config.instanceType}"
  key_name      = "${config.keyPair}"
  ${subnetRef}
  ${securityGroupRef}

  tags = {
    Name = "web-server"
  }
}
`;
    }

    return code;
};

// Add similar endpoints for Azure deployment
app.post('/api/azure/deploy', async (req, res) => {
    const { config, auth } = req.body;

    if (!auth || !azureCredentialsStore[auth.userId]) {
        return res.status(401).json({ message: 'Authentication required or credentials not found.' });
    }

    const azureAuthCredentials = azureCredentialsStore[auth.userId];

    const terraformCode = generateTerraformCodeAzure(config);
    const tfFilePath = path.join(__dirname, 'temp', 'azure_deployment.tf');
    const tfVarsFilePath = path.join(__dirname, 'temp', 'terraform.tfvars');

    try {
        if (!fs.existsSync(path.join(__dirname, 'temp'))){
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        fs.writeFileSync(tfFilePath, terraformCode);
        fs.writeFileSync(tfVarsFilePath, `subscription_id = "${azureAuthCredentials.subscriptionId}"\nclient_id = "${azureAuthCredentials.clientId}"\nclient_secret = "${azureAuthCredentials.clientSecret}"\ntenant_id = "${azureAuthCredentials.tenantId}"\nlocation = "${azureAuthCredentials.location}"`);


        const logs = [];
        const terraformInit = spawn('terraform', ['init'], { cwd: path.join(__dirname, 'temp') });

        terraformInit.stdout.on('data', (data) => {
            logs.push(data.toString());
            res.write(JSON.stringify({ type: 'log', message: data.toString() }));
        });

        terraformInit.stderr.on('data', (data) => {
            logs.push(`ERROR: ${data.toString()}`);
            res.write(JSON.stringify({ type: 'log', message: `ERROR: ${data.toString()}` }));
        });

        terraformInit.on('close', async (code) => {
            if (code !== 0) {
                res.write(JSON.stringify({ type: 'error', message: 'Terraform init failed.' }));
                return res.end();
            }

            const terraformApply = spawn('terraform', ['apply', '-auto-approve', `-var-file=${tfVarsFilePath}`], { cwd: path.join(__dirname, 'temp') });

            terraformApply.stdout.on('data', (data) => {
                logs.push(data.toString());
                res.write(JSON.stringify({ type: 'log', message: data.toString() }));
            });

            terraformApply.stderr.on('data', (data) => {
                logs.push(`ERROR: ${data.toString()}`);
                res.write(JSON.stringify({ type: 'log', message: `ERROR: ${data.toString()}` }));
            });

            terraformApply.on('close', (applyCode) => {
                if (applyCode !== 0) {
                    res.write(JSON.stringify({ type: 'error', message: 'Terraform apply failed.' }));
                } else {
                    res.write(JSON.stringify({ type: 'success', message: 'Deployment complete!' }));
                }
                fs.unlinkSync(tfFilePath);
                fs.unlinkSync(tfVarsFilePath);
                res.end();
            });
        });

    } catch (error) {
        console.error("Backend error:", error);
        res.status(500).json({ message: 'Internal server error during deployment.' });
    }
});

// Function to generate Azure Terraform code based on selected resources and config
const generateTerraformCodeAzure = (config) => {
    return `terraform {
required_providers {
 azurerm = {
   source  = "hashicorp/azurerm"
   version = "~>3.0"
 }
}
}

provider "azurerm" {
features {}
subscription_id = var.subscription_id
client_id       = var.client_id
client_secret   = var.client_secret
tenant_id       = var.tenant_id
}

variable "subscription_id" {
description = "Azure Subscription ID"
type        = string
sensitive   = true
}

variable "client_id" {
description = "Azure Client ID"
type        = string
sensitive   = true
}

variable "client_secret" {
description = "Azure Client Secret"
type        = string
sensitive   = true
}

variable "tenant_id" {
description = "Azure Tenant ID"
type        = string
sensitive   = true
}

variable "location" {
description = "Azure Location"
type        = string
}

resource "azurerm_resource_group" "main" {
name     = "${config.resourceGroup}"
location = var.location
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
admin_password = "Password1234!" // WARNING: Hardcoded password, use a more secure method in production!
}`;
};

// Add new endpoint for Terraform initialization
app.post('/api/terraform/init', async (req, res) => {
    console.log('Inicializando Terraform...');
    
    try {
        if (!fs.existsSync(path.join(__dirname, 'temp'))){
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        
        // Create a basic terraform configuration for initialization
        const basicTerraformConfig = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }
}`;
        
        const tfFilePath = path.join(__dirname, 'temp', 'init.tf');
        fs.writeFileSync(tfFilePath, basicTerraformConfig);
        
        const terraformInit = spawn('terraform', ['init'], { 
            cwd: path.join(__dirname, 'temp'),
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        terraformInit.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        terraformInit.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        terraformInit.on('close', (code) => {
            // Clean up init file
            try {
                fs.unlinkSync(tfFilePath);
            } catch (err) {
                console.error('Error cleaning up init file:', err);
            }
            
            if (code === 0) {
                console.log('Terraform init successful');
                res.json({ 
                    success: true, 
                    message: 'Terraform initialized successfully',
                    output: output 
                });
            } else {
                console.error('Terraform init failed:', errorOutput);
                res.status(500).json({ 
                    success: false, 
                    message: 'Terraform initialization failed',
                    error: errorOutput 
                });
            }
        });
        
    } catch (error) {
        console.error('Error during Terraform init:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during Terraform initialization',
            error: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});
