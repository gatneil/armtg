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
	'count': 0, // name, properties.subnets
	'templateSnippet': {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/virtualNetworks",
	    "location": "[variables('location')]",
	    "properties": {
		"addressSpace": {
		    "addressPrefixes": [
			"10.0.0.0/8"
		    ]
		}
	    }
	}
    },
    'subnet': {
	'fullType': 'Microsoft.Network/virtualNetworks/subnets',
	'shorthand': 'SUBNET',
	'count': 0, // name, properties.addressPrefix
	'requiredDependencyTypes': ['vnet']
    },
    'pip': {
	'fullType': 'Microsoft.Network/publicIpAddresses',
	'shorthand': 'PIP',
	'count': 0, // name
	'templateSnippet': {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/publicIPAddresses",
	    "location": "[variables('location')]",
	    "properties": {
		"publicIPAllocationMethod": "Dynamic"
	    }
	}
    },
    'nic': {
	'fullType': 'Microsoft.Network/networkInterfaces',
	'shorthand': 'NIC',
	'count': 0, // name, properties.ipConfigurations[0].properties.publicIPAddress.id, same.subnet.id
	'requiredDependencyTypes': ['subnet'],
	'optionalDependencyTypes': ['pip', 'lb', 'appgw'],
	'templateSnippet':     {
	    "apiVersion": "2017-04-01",
	    "type": "Microsoft.Network/networkInterfaces",
	    "location": "[variables('location')]",
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
    },
    'boot_diagnostics_sa': {
	'fullType': 'Microsoft.Storage/storageAccounts',
	'shorthand': 'BOOT_DIAGNOSTICS_SA',
	'count': 0, //name
	'templateSnippet': {
	    "type": "Microsoft.Storage/storageAccounts",
	    "apiVersion": "2017-06-01",
	    "location": "[variables('location')]",
	    "sku": {
		"name": "Standard"
	    },
	    "kind": "Storage",
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
	    "location": "[variables('location')]",
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
	'optionalDependencyTypes': ['lb', 'appgw', 'boot_diagnostics_sa'],
	'templateSnippet': {
	    "type": "Microsoft.Compute/virtualMachineScaleSets",
	    "location": "[variables('location')]",
	    "apiVersion": "2017-03-30",
	    "sku": {
		"name": "StandardD1_v2",
		"tier": "Standard",
		"capacity": "2"
	    },
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
	    "type": "Microsoft.Network/loadBalancers",
	    "location": "[variables('location')]",
	    "apiVersion": "2017-04-01",
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
	}
    }//,
//	'appgw': {
//j	'fullType': 'Microsoft.Network/ApplicationGateways',
//	'shorthand': 'APPGW',
//	'count': 0,
//	'optionalDependencyTypes': ['subnet', 'pip']
//    }
}

const dependencyConstraints = ['optional', 'required'];


class ArmTemplateGenerator extends React.Component {
    constructor(props) {
	super(props);
	this.state = {
	    resources: {},
	};
    }

    // NOTE: modifies the resource type count
    getUniqueObjectName(canonicalType) {
	var curCountString = resourceTypes[canonicalType]['count'].toString();
	resourceTypes[canonicalType]['count'] += 1;
	return canonicalType + curCountString;
    }
    
    handlePlusClick(canonicalType) {
	var typeObject = resourceTypes[canonicalType];
	var newObj = cloneDeep(typeObject);
	newObj['name'] = this.getUniqueObjectName(canonicalType);
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

    // takes in a canonical type and returns an array of fully valid template snippets;
    // it is an array because an autogenerated snippet might need to autogenerate dependent
    // resources to be fully valid
    autogenTemplateSnippet(canonicalType) {
	var mainSnippet = cloneDeep(resourceTypes[canonicalType]['templateSnippet']);
	mainSnippet['name'] = this.getUniqueObjectName(canonicalType);
	// !!! TODO
	alert("autogenTemplateSnippet not yet implemented!");
    }

    generateTemplate() {
	// for simplicity of UI, subnets are treated as resources in the UI,
	// but in an ARM template they're actually just config on a virtual network;
	// thus, before generating virtual network resources, we add the subnet configs
	// to the relevant virtual network template snippets
	var newResourcesObj = cloneDeep(this.state.resources);
	var template = {"variables": {"location": "westus"}, "resources": []}
	
	Object.keys(newResourcesObj).map((resourceId, index) => {
	    console.log(newResourcesObj[resourceId]['canonicalType']);
	    if (newResourcesObj[resourceId]['canonicalType'] == 'subnet') {
		var vnetDependencyValue = newResourcesObj[resourceId]['requiredDependencyValues'][0];
		if (vnetDependencyValue == 'autogen') {
		    alert("autogenTemplateSnippet not yet implemented!");
		} else {
		    // if not autogen, then the virtual network object already exists
		    var subnetNumber = parseInt(newResourcesObj[resourceId]['name'].replace('subnet', ''));
		    var addressPrefix = '10.' + subnetNumber.toString() + '.0.0/16';
		    if (!('subnets' in newResourcesObj[vnetDependencyValue]['templateSnippet']['properties'])) {
			newResourcesObj[vnetDependencyValue]['templateSnippet']['properties']['subnets'] = [];
		    }
		    
		    newResourcesObj[vnetDependencyValue]['templateSnippet']['properties']['subnets'].push({'name': newResourcesObj[resourceId]['name'], 'properties': {'addressPrefix': addressPrefix}});
		}
	    } else if (newResourcesObj[resourceId]['canonicalType'] == 'vm' || newResourcesObj[resourceId]['canonicalType'] == 'vmss') {
		console.log('saw vm or vmss');
		if (!('parameters' in template)) {
		    console.log('adding parameters proprty to template');
		    template['parameters'] = {}
		}

		template['parameters']['adminUsername'] = {"type": "string"};
		template['parameters']['adminPassword'] = {"type": "securestring"};
	    }
	});
	
	// TODO add dependsOn clauses
	
	Object.keys(newResourcesObj).map((resourceId, index) => {
	    if ('templateSnippet' in newResourcesObj[resourceId]) {
		template['resources'].push(newResourcesObj[resourceId]['templateSnippet']);
	    }
	});

	this.setState({
	    template: JSON.stringify(template, null, 2)
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
