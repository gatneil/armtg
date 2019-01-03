// test

import React from 'react';
import ReactDOM from 'react-dom';
import Button from '@material-ui/core/Button';
import cloneDeep from 'lodash/cloneDeep';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import Input from '@material-ui/core/Input';

import './index.css'

const resourceTypes = {
    'vnet': {
	'fullType': 'Microsoft.Network/virtualNetworks',
	'shorthand': 'VNET',
	'count': 0,
	'templateSnippet': {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/virtualNetworks",
	    "name": null,
	    "location": "[variables('location')]",
	    "dependsOn": [],
	    "properties": {
		"addressSpace": {
		    "addressPrefixes": [
			"10.0.0.0/8"
		    ]
		}
	    }
	},
	'autogen': (name) => {
	    var partialVnetSnippet = cloneDeep(resourceTypes['vnet']['templateSnippet']);
	    partialVnetSnippet['name'] = name;
	    return partialVnetSnippet;

	    // NOTE: for most resources, 'autogen' is supposed to return a list of completed
	    // resources and the ID of a resource to take a dependency on;
	    // vnet is an exception because nothing references a vnet directly;
	    // instead, they reference a subnet, which references a vnet; so vnet autogen
	    // actually returns just a single partial snippet, which gets used by the subnet
	    // autogen and other places with subnet-specific logic
	}
    },
    'subnet': {
	'fullType': 'Microsoft.Network/virtualNetworks/subnets',
	'shorthand': 'SUBNET',
	'count': 0,
	'requiredDependencyTypes': ['vnet'],
	'autogen': (name) => {
	    var fullVnetSnippet = resourceTypes['vnet'].autogen(getUniqueObjectName('vnet'));
	    fullVnetSnippet['properties']['subnets'] = {'name': name, 'properties': {'addressPrefix': '10.0.0.0/16'}};
	    var vnetId = resourceTypes['vnet']['fullType'] + '/' + fullVnetSnippet['name'];
	    
	    return {"dependencyResourceId": vnetId, "resourceId": vnetId + '/subnets/' + name, "resources": [fullVnetSnippet]};
	}
    },
    'pip': {
	'fullType': 'Microsoft.Network/publicIpAddresses',
	'shorthand': 'PIP',
	'count': 0,
	'templateSnippet': {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/publicIPAddresses",
	    "name": null,
	    "location": "[variables('location')]",
	    "dependsOn": [],
	    "properties": {
		"publicIPAllocationMethod": "Dynamic"
	    }
	},
	'autogen': (name) => {
	    var fullSnippet = cloneDeep(resourceTypes['pip']['templateSnippet']);
	    fullSnippet['name'] = name;
	    var resourceId = fullSnippet['type'] + '/' + name;
	    return {"dependencyResourceId": resourceId, "resourceId": resourceId, "resources": [fullSnippet]};
	}
    },
    'nic': {
	'fullType': 'Microsoft.Network/networkInterfaces',
	'shorthand': 'NIC',
	'count': 0, //properties.ipConfigurations[0].properties.publicIPAddress.id, same.subnet.id
	'requiredDependencyTypes': ['subnet'],
	'optionalDependencyTypes': ['pip', 'lb'/*, 'appgw'*/],
	'templateSnippet':     {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/networkInterfaces",
	    "name": null,
	    "location": "[variables('location')]",
	    "dependsOn": [],
	    "properties": {
		"ipConfigurations": [
		    {
			"name": "ipconfig",
			"properties": {
			    "privateIPAllocationMethod": "Dynamic"
			}
		    }
		]
	    }
	},
	'autogen': (name) => {
	    var fullSnippet = cloneDeep(resourceTypes['nic']['templateSnippet']);
	    fullSnippet['name'] = name;
	    var nicId = fullSnippet['type'] + '/' + name;

	    var autogenedSubnet = resourceTypes['subnet'].autogen(getUniqueObjectName('subnet'));
	    fullSnippet['dependsOn'].push(autogenedSubnet['dependencyResourceId']);
	    fullSnippet['properties']['ipConfigurations'][0]['properties'] = {'subnet': {'id': autogenedSubnet['resourceId']}};
	    var fullResourcesList = [fullSnippet];
	    fullResourcesList.push(autogenedSubnet['resources']);

	    return {"dependencyResourceId": nicId, "resourceId": nicId, "resources": fullResourcesList};
	},
	'addRequiredProperties': (templateSnippet, mapping)  => {
	    // mapping contains a subnetId
	    var res = cloneDeep(templateSnippet);
	    res['properties']['ipConfigurations'][0]['properties']['subnet'] = {"id": mapping['subnetId']};
	    return res;
	}
    },
    'boot_diagnostics_sa': {
	'fullType': 'Microsoft.Storage/storageAccounts',
	'shorthand': 'BOOT_DIAGNOSTICS_SA',
	'count': 0, //name
	'templateSnippet': {
	    "apiVersion": "2017-06-01",
	    "type": "Microsoft.Storage/storageAccounts",
	    "name": null,
	    "location": "[variables('location')]",
	    "sku": {
		"name": "Standard"
	    },
	    "kind": "Storage",
	    "dependsOn": [],
	    "properties": {}
	}
    },
    'vm': {
	'fullType': 'Microsoft.Compute/virtualMachines',
	'shorthand': 'VM',
	'count': 0, //name, properties.osProfile.computerName, properties.networkProfile.networkInterfaces[0].id, properties.diagnosticsProfile.bootDiagnostics.enabled, same.storageUri
	'requiredDependencyTypes': ['nic'],
	'optionalDependencyTypes': ['boot_diagnostics_sa'],
	'templateSnippet':     {
	    "apiVersion": "2017-03-30",
	    "type": "Microsoft.Compute/virtualMachines",
	    "name": null,
	    "location": "[variables('location')]",
	    "dependsOn": [],
	    "properties": {
		"hardwareProfile": {
		    "vmSize": "StandardD1_v2"
		},
		"osProfile": {
		    "adminUsername": "[parameters('adminUsername')]",
		    "adminPassword": "[parameters('adminPassword')]"
		},
		"storageProfile": {
		    "imageReference": {
			"publisher": "Canonical",
			"offer": "UbuntuServer",
			"sku": "16.04-LTS",
			"version": "latest"
		    },
		    "osDisk": {
			"createOption": "FromImage"
		    }
		},
		"networkProfile": {
		    "networkInterfaces": [
			{}
		    ]
		}
	    }
	}
    },
    'vmss': {
	'fullType': 'Microsoft.Compute/virtualMachineScaleSets',
	'shorthand': 'VMSS',
	'count': 0, // name, properties.virtualMachineProfile.osProfile.computerNamePrefix, properties.virtualMachineProfile.networkProfile,networkInterfaceConfigurations[0].properties.ipCOnfigurations[0].properties.subnet.id, same.loadBalancerBackendAddressPools[0].id, same.loadBalancerInboundNatPools[0].id
	'requiredDependencyTypes': ['subnet'],
	'optionalDependencyTypes': ['lb', /*'appgw',*/ 'boot_diagnostics_sa'],
	'templateSnippet': {
	    "apiVersion": "2017-03-30",
	    "type": "Microsoft.Compute/virtualMachineScaleSets",
	    "name": null,
	    "location": "[variables('location')]",
	    "sku": {
		"name": "StandardD1_v2",
		"tier": "Standard",
		"capacity": "2"
	    },
	    "dependsOn": [],
	    "properties": {
		"overprovision": "false",
		"upgradePolicy": {
		    "mode": "Automatic"
		},
		"virtualMachineProfile": {
		    "storageProfile": {
			"osDisk": {
			    "createOption": "FromImage",
			    "caching": "ReadWrite"
			},
			"imageReference": {
			    "publisher": "Canonical",
			    "offer": "UbuntuServer",
			    "sku": "16.04-LTS",
			    "version": "latest"
			},
		    },
		    "osProfile": {
			"adminUsername": "[parameters('adminUsername')]",
			"adminPassword": "[parameters('adminPassword')]"
		    },
		    "networkProfile": {
			"networkInterfaceConfigurations": [
			    {
				"name": "nicConfig",
				"properties": {
				    "primary": true,
				    "ipConfigurations": [
					{
					    "name": "ipconfig",
					    "properties": {
						"subnet": {
						    "id": "[concat('/subscriptions/', subscription().subscriptionId,'/resourceGroups/', resourceGroup().name, '/providers/Microsoft.Network/virtualNetworks/', variables('virtualNetworkName'), '/subnets/', variables('subnetName'))]"
						},
						"loadBalancerBackendAddressPools": null,
						"loadBalancerInboundNatPools": null
					    }
					}
				    ]
				}
			    }
			]
		    }
		}
	    }
	}
    },
    'lb': {
	'fullType': 'Microsoft.Network/loadBalancers',
	'shorthand': 'LB',
	'count': 0, // name, properties.frontendIPConfigurations.name, same.properties.publicIPAddress.id
	'optionalDependencyTypes': ['subnet', 'pip'],
	'templateSnippet': {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/loadBalancers",
	    "name": null,
	    "location": "[variables('location')]",
	    "dependsOn": [],
	    "properties": {
		"frontendIPConfigurations": [],
		"backendAddressPools": [
		    {
			"name": "[variables('bePoolName')]"
		    }
		],
		"inboundNatPools": [
		    {
			"name": "[variables('natPoolName')]",
			"properties": {
			    "frontendIPConfiguration": {
				"id": "[variables('frontEndIPConfigID')]"
			    },
			    "protocol": "tcp",
			    "frontendPortRangeStart": "[variables('natStartPort')]",
			    "frontendPortRangeEnd": "[variables('natEndPort')]",
			    "backendPort": "[variables('natBackendPort')]"
			}
		    }
		]
	    }
	},
	'autogen': (name) => {
	    var fullSnippet = cloneDeep(resourceTypes['lb']['templateSnippet']);
	    fullSnippet['name'] = name;
	    fullSnippet['properties']['frontendIPConfigurations'].push({'name': name + 'IPConfig'});
	    var resourceId = fullSnippet['type'] + '/' + name;
	    return {"dependencyResourceId": resourceId, "resourceId": resourceId, "resources": [fullSnippet]};
	}
    }/*,
    'appgw': {
	'fullType': 'Microsoft.Network/ApplicationGateways',
	'shorthand': 'APPGW',
	'count': 0,
	'optionalDependencyTypes': ['subnet', 'pip'],
	'templateSnippet': { // name, properties.gatewayIPConfigurations[0].properties.subnet.id, properties.frontendIPConfigurations[0].properties.publicIPAddress.id, same.subnet.id?, properties.httpListeners[0].properties.ForntendIPConfiguration.id, same.FrontendPort.id, properties.requestRoutingRules.[0].properties.httpListener.id, same.backendAddressPool.id, same.backendHttpSettings.id (backendHttpSettingsCollection/appGwBackendHttpSettings)
	    "type": "Microsoft.Network/applicationGateways",
	    "name": null,
	    "location": "[resourceGroup().location]",
	    "apiVersion": "2017-04-01",
	    "dependsOn": [],
	    "properties": {
		"sku": {
		    "name": "Standard_Small",
		    "tier": "Standard",
		    "capacity": "2"
		},
		"gatewayIPConfigurations": [
		    {
			"name": "appGwIpConfig",
			"properties": {
			    "subnet": {
				"id": null
			    }
			}
		    }
		],
		"frontendIPConfigurations": [
		    {
			"name": "frontendIPConfiguration"
		    }
		],
		"frontendPorts": [
		    {
			"name": "appGwFrontendPort",
			"properties": {
			    "Port": 80
			}
		    }
		],
		"backendAddressPools": [
		    {
			"name": "backendAddressPool"
		    }
		],
		"backendHttpSettingsCollection": [
		    {
			"name": "appGwBackendHttpSettings",
			"properties": {
			    "Port": 80,
			    "Protocol": "Http",
			    "CookieBasedAffinity": "Disabled"
			}
		    }
		],
		"httpListeners": [
		    {
			"name": "appGwHttpListener",
			"properties": {
			    "FrontendIPConfiguration": {
				"Id": null
			    },
			    "FrontendPort": {
				"Id": null
			    },
			    "Protocol": "Http",
			    "SslCertificate": null
			}
		    }
		],
		"requestRoutingRules": [
		    {
			"Name": "routingRule",
			"properties": {
			    "RuleType": "Basic",
			    "httpListener": {
				"id": "[concat(variables('appGwID'), '/httpListeners/appGwHttpListener')]"
			    },
			    "backendAddressPool": {
				"id": "[concat(variables('appGwID'), '/backendAddressPools/', variables('appGwBePoolName'))]"
			    },
			    "backendHttpSettings": {
				"id": "[concat(variables('appGwID'), '/backendHttpSettingsCollection/appGwBackendHttpSettings')]"
			    }
			}
		    }
		]
	    }
	}
    }
     */
}

// NOTE: modifies the resource type count
function getUniqueObjectName(canonicalType) {
    var curCountString = resourceTypes[canonicalType]['count'].toString();
    resourceTypes[canonicalType]['count'] += 1;
    return canonicalType + curCountString;
}

const dependencyConstraints = ['optional', 'required'];


class ArmTemplateGenerator extends React.Component {
    constructor(props) {
	super(props);
	this.state = {
	    resources: {},
	};
    }


    
    handlePlusClick(canonicalType) {
	var typeObject = resourceTypes[canonicalType];
	var newObj = cloneDeep(typeObject);
	newObj['name'] = getUniqueObjectName(canonicalType);
	newObj['canonicalType'] = canonicalType;
	
	if ('requiredDependencyTypes' in newObj) {
	    const requiredDependencyValues = newObj['requiredDependencyTypes'].map((typeString, index) => {
		return 'autogen';
	    });

	    newObj['requiredDependencyValues'] = requiredDependencyValues;
	}

	if ('optionalDependencyTypes' in newObj) {
	    const optionalDependencyValues = newObj['optionalDependencyTypes'].map((typeString, index) => {
		return 'none';
	    });

	    newObj['optionalDependencyValues'] = optionalDependencyValues;
	}
	
	var newResourcesObj = cloneDeep(this.state.resources);
	var resourceId = newObj["fullType"] + "/" + newObj["name"];
	newObj['resourceId'] = resourceId;
	newResourcesObj[resourceId] = newObj;

	this.setState({
	    resources: newResourcesObj
	});
    }

    handleDeleteClick(resourceId) {
	// remove resource from current resources
	var newResourcesObj = cloneDeep(this.state.resources);
	delete newResourcesObj[resourceId];

	// remove any dependencies pointing to this resource
	Object.keys(this.state.resources).map((mapResourceId, index) => {
	    dependencyConstraints.map((dependencyConstraint, dependencyConstraintIndex) => {
		var constraintValueString = dependencyConstraint + 'DependencyValues';
		if (constraintValueString in this.state.resources[mapResourceId]) {
		    this.state.resources[mapResourceId][constraintValueString].map((dependencyValue, dependencyIndex) => {
			if (dependencyValue === resourceId) {
			    if (dependencyConstraint == 'optional') {
				newResourcesObj[mapResourceId][constraintValueString][dependencyIndex] = 'none';
			    } else {
				newResourcesObj[mapResourceId][constraintValueString][dependencyIndex] = 'autogen';
			    }
			}
		    });
		}
	    });
	});
	
	this.setState({
	    resources: newResourcesObj
	});
    }

    handleDependencyValueChange(dependencyConstraint, dependencyIndex, resourceId, event) {
	var newResourcesObj = cloneDeep(this.state.resources);
	newResourcesObj[resourceId][dependencyConstraint + "DependencyValues"][dependencyIndex] = event.target.value;
	this.setState({
	    resources: newResourcesObj
	});
    }

    getResourcesByCanonicalType(canonicalType) {
	return Object.keys(this.state.resources).map((resourceId, index) => {
	    return this.state.resources[resourceId]['canonicalType'] === canonicalType ? this.state.resources[resourceId] : null
	}).filter(item => item != null);
    }


    generateTemplate() {

	var newResourcesObj = cloneDeep(this.state.resources);
	var template = {"variables": {"location": "westus"}, "resources": []}
	var subnetToVnetMap = {};

	// rearrange specific properties
	Object.keys(newResourcesObj).map((resourceId, index) => {
	    if (newResourcesObj[resourceId]['canonicalType'] == 'subnet') {
		// for simplicity of UI, subnets are treated as resources in the UI,
		// but in an ARM template they're actually just config on a virtual network;
		// thus, before generating virtual network resources, we add the subnet configs
		// to the relevant virtual network template snippets
		
		var vnetDependencyValue = newResourcesObj[resourceId]['requiredDependencyValues'][0];
		console.log(vnetDependencyValue);

		// autogen the base vnet object if necessary so we can add the subnet to it
		if (vnetDependencyValue == 'autogen') {
		    var partialVnetSnippet = resourceTypes['vnet'].autogen(getUniqueObjectName('vnet'));
		    vnetDependencyValue = partialVnetSnippet['type'] + '/' + partialVnetSnippet['name'];
		    newResourcesObj[vnetDependencyValue] = {'templateSnippet': partialVnetSnippet};
		}
		
		// vnetDependencyValue is the full resource ID of the virtual network
		subnetToVnetMap[resourceId] = vnetDependencyValue;
		var subnetNumber = parseInt(newResourcesObj[resourceId]['name'].replace('subnet', ''));
		var addressPrefix = '10.' + subnetNumber.toString() + '.0.0/16';
		if (!('subnets' in newResourcesObj[vnetDependencyValue]['templateSnippet']['properties'])) {
		    newResourcesObj[vnetDependencyValue]['templateSnippet']['properties']['subnets'] = [];
		}
		
		newResourcesObj[vnetDependencyValue]['templateSnippet']['properties']['subnets'].push({'name': newResourcesObj[resourceId]['name'], 'properties': {'addressPrefix': addressPrefix}});

	    } else if (newResourcesObj[resourceId]['canonicalType'] == 'vm' || newResourcesObj[resourceId]['canonicalType'] == 'vmss') {
		// VMs and scale sets require usernames and passwords (or ssh keys), but it would be
		// bad to hard-code these, so we add them as parmeters for the user to fill in
		if (!('parameters' in template)) {
		    template['parameters'] = {}
		}
		
		template['parameters']['adminUsername'] = {"type": "string"};
		template['parameters']['adminPassword'] = {"type": "securestring"};
	    }
	});

	// add dependsOn clauses to avoid race conditions
	Object.keys(newResourcesObj).map((resourceId, index) => {
	    dependencyConstraints.map((dependencyConstraint, dependencyConstraintIndex) => {
		var constraintValueString = dependencyConstraint + 'DependencyValues';
		var constraintTypeString = dependencyConstraint + 'DependencyTypes';
		if (constraintValueString in newResourcesObj[resourceId]) {
		    newResourcesObj[resourceId][constraintValueString].map((dependencyValue, dependencyIndex) => {
			if (dependencyValue == 'none') {
			    return;
			} else if (dependencyValue == 'autogen') {
			    var dependencyCanonicalType = newResourcesObj[resourceId][constraintTypeString][dependencyIndex];
			    // autogenerated resources are already snippets, so add them directly to the template instead
			    // of to the newResourcesObj first
			    var autogeneratedResources = resourceTypes[dependencyCanonicalType].autogen(getUniqueObjectName(dependencyCanonicalType));
			    autogeneratedResources['resources'].map((autogeneratedResource, autogeneratedResourceIndex) => {
				template['resources'].push(autogeneratedResource);
			    });

			    // update the resource to refer to the autogenerated resource
			    // (*** TODO !!! ***)
			    //newResourcesObj[resourceId]['templateSnippet'] = resourceTypes[newResourcesObj[resourceId]['canonicalType']].addRequiredProperties(newResourcesObj[resourceId]['templateSnippet'], {'subnetId': autogeneratedResources['resourceId']});

			    newResourcesObj[resourceId]['templateSnippet']['dependsOn'].push(autogeneratedResources['dependencyResourceId']);
			} else {
			    // dependencyValue is the full resource ID of the dependency
			    if (newResourcesObj[resourceId][constraintTypeString][dependencyIndex] == 'subnet') {
				// the dependsOn actually points to the vnet, not the subnet
				newResourcesObj[resourceId]['templateSnippet']['dependsOn'].push(subnetToVnetMap[dependencyValue]);
			    } else {
				if ('templateSnippet' in newResourcesObj[resourceId]) {
				    newResourcesObj[resourceId]['templateSnippet']['dependsOn'].push(dependencyValue);
				}

				// NOTE: this particular if-condition is basically another check to handle subnets properly;
				// there's probably a better way to organize generateTemplate() overall
			    }
			}
		    });
		}
	    });
	});
	
	// add the resource blocks to the template
	Object.keys(newResourcesObj).map((resourceId, index) => {
	    // lack of 'templateSnippet' in a resource indicates that it isn't a top-level resource, so
	    // it doesn't need to be added separately; it's already handled by a different resource
	    if ('templateSnippet' in newResourcesObj[resourceId]) {
		newResourcesObj[resourceId]['templateSnippet']['name'] = newResourcesObj[resourceId]['name'];
		template['resources'].push(newResourcesObj[resourceId]['templateSnippet']);
	    }
	});

	// reorder top-level template properties to the canonical ordering of
	// parameters, variables, then resources (no outputs)
	var orderedTemplate = {};
	if ('parameters' in template) {
	    orderedTemplate['parameters'] = template['parameters'];
	}
	
	orderedTemplate['variables'] = template['variables'];
	orderedTemplate['resources'] = template['resources'];

	this.setState({
	    template: JSON.stringify(orderedTemplate, null, 2)
	});
    }

    render() {
	const plusResourceButtons = Object.keys(resourceTypes).map((canonicalType, index) => {
	    return (
		    <Button size="small" onClick={() => this.handlePlusClick(canonicalType)}>+{resourceTypes[canonicalType]['shorthand']}</Button>
	    )
	});

	const currentResources = Object.keys(this.state.resources).map((resourceId, resourceIndex) => {

	    // first is UI for optional dependencies, second for required dependencies (based on dependencyConstraints global variable)
	    var dependencyUIs = [null, null];

	    dependencyConstraints.map((dependencyConstraint, dependencyConstraintIndex) => {
		if (dependencyConstraint + 'DependencyTypes' in this.state.resources[resourceId]) {
		    dependencyUIs[dependencyConstraintIndex] = this.state.resources[resourceId][dependencyConstraint + 'DependencyTypes'].map((dependencyType, dependencyIndex) => {
			var suggestedResources = this.getResourcesByCanonicalType(this.state.resources[resourceId][dependencyConstraint + 'DependencyTypes'][dependencyIndex]);
			var suggestedResourcesMenuItems = suggestedResources.map((suggestedResourceObj, suggestedResourceObjIndex) => {
			    return <MenuItem value={suggestedResourceObj['resourceId']}>{suggestedResourceObj['name']}</MenuItem>
			});

			if (dependencyConstraint == 'optional') {
			    suggestedResourcesMenuItems.push(<MenuItem value="none">none</MenuItem>);
			}
			
			suggestedResourcesMenuItems.push(<MenuItem value="autogen">autogen</MenuItem>);
			
			return (
				<form autoComplete="off">
				<FormControl>
				<InputLabel shrink>
				{this.state.resources[resourceId][dependencyConstraint + 'DependencyTypes'][dependencyIndex]}
			    </InputLabel>
				<Select
			    value={this.state.resources[resourceId][dependencyConstraint + 'DependencyValues'][dependencyIndex]}
			    onChange={(event) => this.handleDependencyValueChange(dependencyConstraint, dependencyIndex, resourceId, event)}
			    input={<Input/>}
			    displayEmpty
				>
				{suggestedResourcesMenuItems}
			    </Select>
				</FormControl>
				</form>
			)
		    });
		}
	    });

	    // flatten dependencyUIs into one string
	    var finalDependencyUI = [].concat.apply([], dependencyUIs);
	    
	    
	    return (
		    <Grid item xs={4}>
		    <Card className="card">
		    <CardHeader
		action={
		        <IconButton>
			<DeleteIcon onClick={() => this.handleDeleteClick(resourceId)}/>
			</IconButton>
		}
		title={this.state.resources[resourceId]['name']}
		subheader={this.state.resources[resourceId]['canonicalType']}
		       />
		    
		    <CardContent>
		    
		{finalDependencyUI}
		    
		</CardContent>
		    </Card>
		    </Grid>
	    )
	});

	
	return (
	    <div>
		<div>
		
	    {plusResourceButtons}
	    
	    </div>

	    <br />
		
		<div>
		<Grid container spacing={24}>
		{currentResources}
	    </Grid>
	    
	    </div>

	    <br />
		
		<Button size="small" onClick={() => this.generateTemplate()}>Generate Template</Button>
		<div className="left">
		{'template' in this.state ? <pre><code>{this.state.template}</code></pre> : null}
		</div>
		
		</div>
	)
    }
}


ReactDOM.render(<ArmTemplateGenerator />,
		document.getElementById('root')
	       );
