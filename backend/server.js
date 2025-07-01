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
    console.log('Health check requested');
    res.json({ status: 'Backend server is running', timestamp: new Date().toISOString() });
});

// In a real application, securely store and retrieve credentials
const awsCredentialsStore = {};
const azureCredentialsStore = {};

// Function to get user-specific temp directory
const getUserTempDir = (userId) => {
    const userTempDir = path.join(__dirname, 'temp', userId);
    if (!fs.existsSync(userTempDir)) {
        fs.mkdirSync(userTempDir, { recursive: true });
    }
    return userTempDir;
};

// Function to save created resources
const saveCreatedResource = (userId, resource) => {
    try {
        const userTempDir = getUserTempDir(userId);
        const resourcesFile = path.join(userTempDir, 'created_resources.json');
        
        let resources = [];
        if (fs.existsSync(resourcesFile)) {
            const data = fs.readFileSync(resourcesFile, 'utf8');
            resources = JSON.parse(data);
        }
        
        resources.push({
            ...resource,
            createdAt: new Date().toISOString()
        });
        
        fs.writeFileSync(resourcesFile, JSON.stringify(resources, null, 2));
        console.log(`✅ Recurso salvo para usuário ${userId}:`, resource);
    } catch (error) {
        console.error('❌ Erro ao salvar recurso:', error);
    }
};

// Function to parse Terraform output and extract resource IDs
const parseResourcesFromOutput = (output, userId) => {
    const resources = [];
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for resource creation patterns
        if (line.includes(': Creation complete after')) {
            const match = line.match(/([^:]+): Creation complete after .* \[id=([^\]]+)\]/);
            if (match) {
                const resourceName = match[1].trim();
                const resourceId = match[2];
                
                // Parse resource type and name
                const parts = resourceName.split('.');
                if (parts.length >= 2) {
                    const resourceType = parts[0].replace('aws_', '');
                    const name = parts[1];
                    
                    const resource = {
                        id: resourceId,
                        type: resourceType,
                        name: name,
                        status: 'available',
                        region: 'us-east-1' // Default region
                    };
                    
                    resources.push(resource);
                    saveCreatedResource(userId, resource);
                }
            }
        }
    }
    
    return resources;
};

// Endpoint to get user resources
app.get('/api/aws/resources/:userId', (req, res) => {
    const { userId } = req.params;
    console.log('📋 Carregando recursos para userId:', userId);
    
    try {
        const userTempDir = getUserTempDir(userId);
        const resourcesFile = path.join(userTempDir, 'created_resources.json');
        
        if (fs.existsSync(resourcesFile)) {
            const data = fs.readFileSync(resourcesFile, 'utf8');
            const resources = JSON.parse(data);
            console.log('✅ Recursos encontrados:', resources.length);
            res.json({ resources: resources });
        } else {
            console.log('📭 Nenhum recurso encontrado para userId:', userId);
            res.json({ resources: [] });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar recursos:', error);
        res.status(500).json({ error: 'Erro ao carregar recursos' });
    }
});

// Endpoint to check resource status
app.post('/api/aws/resource-status', (req, res) => {
    const { resourceId, resourceType } = req.body;
    
    // For now, return a default status - in a real implementation, this would check AWS
    res.json({ status: 'available' });
});

// Endpoint to get resource details
app.post('/api/aws/resource-details', (req, res) => {
    const { resourceId, resourceType } = req.body;
    
    // For now, return empty details - in a real implementation, this would fetch from AWS
    res.json({ details: {} });
});

// Endpoint para armazenar credenciais AWS
app.post('/api/aws/credentials', (req, res) => {
    console.log('📝 Recebendo credenciais AWS...');
    console.log('Request body:', req.body);
    
    const { userId, credentials } = req.body;
    
    if (!userId || !credentials) {
        console.error('❌ Dados faltando:', { userId: !!userId, credentials: !!credentials });
        return res.status(400).json({ 
            success: false,
            message: 'userId e credentials são obrigatórios' 
        });
    }
    
    // Validar credenciais AWS
    if (!credentials.accessKey || !credentials.secretKey || !credentials.region) {
        console.error('❌ Credenciais AWS incompletas');
        return res.status(400).json({ 
            success: false,
            message: 'accessKey, secretKey e region são obrigatórios' 
        });
    }
    
    awsCredentialsStore[userId] = credentials;
    console.log('✅ Credenciais AWS armazenadas para userId:', userId);
    
    res.json({ 
        success: true,
        message: 'Credenciais AWS armazenadas com sucesso' 
    });
});

// Add new endpoint for Terraform reinitialization
app.post('/api/terraform/reinit', async (req, res) => {
    console.log('🔄 Reinicializando Terraform para nova execução...');
    const { userId } = req.body;
    
    try {
        const userTempDir = getUserTempDir(userId || 'default');
        
        // Clean up any existing state files
        const stateFiles = ['.terraform.lock.hcl', 'terraform.tfstate', 'terraform.tfstate.backup'];
        const terraformDir = path.join(userTempDir, '.terraform');
        
        // Remove state files
        stateFiles.forEach(file => {
            const filePath = path.join(userTempDir, file);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Removido: ${file}`);
                } catch (err) {
                    console.warn(`⚠️ Aviso ao remover ${file}:`, err.message);
                }
            }
        });
        
        // Remove .terraform directory
        if (fs.existsSync(terraformDir)) {
            try {
                fs.rmSync(terraformDir, { recursive: true, force: true });
                console.log('🗑️ Diretório .terraform removido');
            } catch (err) {
                console.warn('⚠️ Aviso ao remover .terraform:', err.message);
            }
        }
        
        console.log('✅ Terraform reinicializado - arquivos de estado limpos');
        res.json({ 
            success: true, 
            message: 'Terraform reinicializado com sucesso' 
        });
        
    } catch (error) {
        console.error('❌ Erro ao reinicializar Terraform:', error);
        res.json({ 
            success: false, 
            message: 'Aviso na reinicialização, mas continuando...', 
            error: error.message 
        });
    }
});

app.post('/api/aws/deploy', async (req, res) => {
    console.log('Iniciando deployment AWS...');
    const { resources, config, auth } = req.body;

    if (!auth || !awsCredentialsStore[auth.userId]) {
        console.error('Autenticação falhou:', { auth: !!auth, credentials: !!awsCredentialsStore[auth?.userId] });
        return res.status(401).json({ message: 'Authentication required or credentials not found.' });
    }

    const awsAuthCredentials = awsCredentialsStore[auth.userId];
    const userId = auth.userId;
    console.log('Credenciais encontradas, gerando Terraform...');

    // Generate Terraform .tf file content dynamically based on selected resources
    const terraformCode = generateTerraformCodeAWS(resources, config, awsAuthCredentials);
    const userTempDir = getUserTempDir(userId);
    const tfFilePath = path.join(userTempDir, 'aws_deployment.tf');
    const tfVarsFilePath = path.join(userTempDir, 'terraform.tfvars');

    try {
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
        let allOutput = '';
        
        // Send initial message
        res.write(JSON.stringify({ type: 'log', message: 'Iniciando Terraform init...\n' }));
        console.log('🚀 Executando terraform init...');

        const terraformInit = spawn('terraform', ['init'], { 
            cwd: userTempDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let initOutput = '';
        let initError = '';

        terraformInit.stdout.on('data', (data) => {
            const message = data.toString();
            initOutput += message;
            allOutput += message;
            console.log('TERRAFORM INIT STDOUT:', message);
            logs.push(message);
            res.write(JSON.stringify({ type: 'log', message: message }));
        });

        terraformInit.stderr.on('data', (data) => {
            const message = `ERROR: ${data.toString()}`;
            initError += data.toString();
            allOutput += data.toString();
            console.error('TERRAFORM INIT STDERR:', data.toString());
            logs.push(message);
            res.write(JSON.stringify({ type: 'log', message: message }));
        });

        terraformInit.on('close', async (code) => {
            console.log(`Terraform init finalizado com código: ${code}`);
            console.log('Init Output:', initOutput);
            console.log('Init Error:', initError);
            
            if (code !== 0) {
                console.error('Terraform init falhou com código:', code);
                res.write(JSON.stringify({ 
                    type: 'error', 
                    message: `Terraform init failed with code ${code}. Error: ${initError}` 
                }));
                return res.end();
            }

            console.log('Terraform init concluído, iniciando apply...');
            res.write(JSON.stringify({ type: 'log', message: '\nTerraform init concluído. Iniciando apply --auto-approve...\n' }));

            const terraformApply = spawn('terraform', ['apply', '-auto-approve', `-var-file=${tfVarsFilePath}`], { 
                cwd: userTempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let applyOutput = '';
            let applyError = '';

            terraformApply.stdout.on('data', (data) => {
                const message = data.toString();
                applyOutput += message;
                allOutput += message;
                console.log('TERRAFORM APPLY STDOUT:', message);
                logs.push(message);
                res.write(JSON.stringify({ type: 'log', message: message }));
            });

            terraformApply.stderr.on('data', (data) => {
                const message = `ERROR: ${data.toString()}`;
                applyError += data.toString();
                allOutput += message;
                console.error('TERRAFORM APPLY STDERR:', data.toString());
                logs.push(message);
                res.write(JSON.stringify({ type: 'log', message: message }));
            });

            terraformApply.on('close', (applyCode) => {
                console.log(`Terraform apply finalizado com código: ${applyCode}`);
                console.log('Apply Output:', applyOutput);
                console.log('Apply Error:', applyError);
                
                if (applyCode !== 0) {
                    console.error('Terraform apply falhou com código:', applyCode);
                    res.write(JSON.stringify({ 
                        type: 'error', 
                        message: `Terraform apply failed with code ${applyCode}. Error: ${applyError}` 
                    }));
                } else {
                    console.log('Terraform apply concluído com sucesso!');
                    
                    // Parse resources from output and save them
                    const createdResources = parseResourcesFromOutput(allOutput, userId);
                    console.log('📋 Recursos criados detectados:', createdResources);
                    
                    res.write(JSON.stringify({ 
                        type: 'success', 
                        message: 'Deployment complete!',
                        resources: createdResources
                    }));
                }
                
                // Don't clean up files anymore - keep them for user management
                console.log('📁 Arquivos mantidos na pasta do usuário:', userTempDir);
                
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
    const userId = auth.userId;

    const terraformCode = generateTerraformCodeAzure(config);
    const userTempDir = getUserTempDir(userId);
    const tfFilePath = path.join(userTempDir, 'azure_deployment.tf');
    const tfVarsFilePath = path.join(userTempDir, 'terraform.tfvars');

    try {
        fs.writeFileSync(tfFilePath, terraformCode);
        fs.writeFileSync(tfVarsFilePath, `subscription_id = "${azureAuthCredentials.subscriptionId}"\nclient_id = "${azureAuthCredentials.clientId}"\nclient_secret = "${azureAuthCredentials.clientSecret}"\ntenant_id = "${azureAuthCredentials.tenantId}"\nlocation = "${azureAuthCredentials.location}"`);

        const logs = [];
        const terraformInit = spawn('terraform', ['init'], { cwd: userTempDir });

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

            const terraformApply = spawn('terraform', ['apply', '-auto-approve', `-var-file=${tfVarsFilePath}`], { cwd: userTempDir });

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
    const { userId } = req.body;
    const userTempDir = getUserTempDir(userId || 'default');
    
    try {
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
        
        const tfFilePath = path.join(userTempDir, 'init.tf');
        fs.writeFileSync(tfFilePath, basicTerraformConfig);
        
        const terraformInit = spawn('terraform', ['init'], { 
            cwd: userTempDir,
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
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📋 Health check available at: http://localhost:${PORT}/health`);
    console.log(`🔐 AWS credentials endpoint: http://localhost:${PORT}/api/aws/credentials`);
});
