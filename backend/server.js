const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // For local development

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// In a real application, securely store and retrieve credentials
const awsCredentialsStore = {};
const azureCredentialsStore = {};

app.post('/api/aws/deploy', async (req, res) => {
    const { resources, config, auth } = req.body; // auth will contain keys to retrieve credentials from store

    if (!auth || !awsCredentialsStore[auth.userId]) { // Example: userId to link to stored credentials
        return res.status(401).json({ message: 'Authentication required or credentials not found.' });
    }

    const awsAuthCredentials = awsCredentialsStore[auth.userId]; // Retrieve securely

    // Generate Terraform .tf file content dynamically
    const terraformCode = generateTerraformCodeAWS(resources, config, awsAuthCredentials);
    const tfFilePath = path.join(__dirname, 'temp', 'aws_deployment.tf');
    const tfVarsFilePath = path.join(__dirname, 'temp', 'terraform.tfvars'); // For sensitive data

    try {
        if (!fs.existsSync(path.join(__dirname, 'temp'))){
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        fs.writeFileSync(tfFilePath, terraformCode);
        // Write sensitive data to .tfvars, ensuring it's not committed to VCS
        fs.writeFileSync(tfVarsFilePath, `access_key = "<span class="math-inline">\{awsAuthCredentials\.accessKey\}"\\nsecret\_key \= "</span>{awsAuthCredentials.secretKey}"\nregion = "${awsAuthCredentials.region}"`);
        // Handle token if present
        if (awsAuthCredentials.token) {
            fs.appendFileSync(tfVarsFilePath, `\ntoken = "${awsAuthCredentials.token}"`);
        }

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
                // Clean up .tf and .tfvars files in a real scenario
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
${authCredentials.token ? 'token = var.token' : ''}
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

    if (resources.vpc) {
        code += `
resource "aws_vpc" "main" {
cidr_block = "<span class="math-inline">\{config\.vpcCidr\}"
tags \= \{
Name \= "</span>{config.vpcName}"
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
cidr_block = "<span class="math-inline">\{config\.subnetCidr\}"
tags \= \{
Name \= "</span>{config.subnetName}"
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
instance_type = "<span class="math-inline">\{config\.instanceType\}"
key\_name      \= "</span>{config.keyPair}"
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
        fs.writeFileSync(tfVarsFilePath, `subscription_id = "<span class="math-inline">\{azureAuthCredentials\.subscriptionId\}"\\nclient\_id \= "</span>{azureAuthCredentials.clientId}"\nclient_secret = "<span class="math-inline">\{azureAuthCredentials\.clientSecret\}"\\ntenant\_id \= "</span>{azureAuthCredentials.tenantId}"\nlocation = "${azureAuthCredentials.location}"`);


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
name     = "<span class="math-inline">\{config\.resourceGroup\}"
<6\>location \= var\.location
\}
resource "azurerm\_virtual\_network" "main" \{
name                \= "vnet\-main"
<7\>address\_space       \= \["10\.0\.0\.0/16"\]
location            \= azurerm\_resource\_group\.main\.location
resource\_group\_name \= azurerm\_resource\_group\.main\.name</6\>
\}
resource "azurerm\_subnet" "internal" \{
name                 \= "internal"
resource\_group\_name  \= azurerm\_resource\_group\.main\.name
virtual\_network\_name \= azurerm\_virtual\_network\.main\.name
address\_prefixes</7\>     \= \["10\.0\.2\.0/24"\]
\}
resource "azurerm\_linux\_virtual\_machine" "main" \{
name                \= "vm\-main"
resource\_group\_name \= azurerm\_resource\_group\.main\.name
location            \= azurerm\_resource\_group\.main\.location
size                \= "</span>{config.vmSize}"
admin_username      = "${config.adminUsername}"

disable_password_authentication = false
admin_password = "Password1234!" // WARNING: Hardcoded password, use a more secure method in production!
}`;
};

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});