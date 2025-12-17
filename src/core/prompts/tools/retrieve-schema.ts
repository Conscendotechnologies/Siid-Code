import { ToolArgs } from "./types"

export function getRetrieveSchemaDescription(args: ToolArgs): string {
	return `## retrieve_schema
Description: Retrieves XML schema definitions from WSDL files (Salesforce Metadata API and Apex API). This tool searches for component definitions (complexType, simpleType, element, message, operation) in the XML schema files and returns the raw XML definition. Useful for understanding the structure of Salesforce API components when creating XML-based components.

Available Schema Files:
- metadata: Salesforce Metadata API v65.0 (metadata.xml) - Contains definitions for Deploy, Retrieve, and other metadata operations
- apex: Salesforce Apex API v65.0 (apex.xml) - Contains definitions for Apex compilation, testing, and execution

Parameters:
- component_name: (required) The name of the component/type to retrieve schema for (e.g., DeployResult, CompileAndTestRequest, RunTestsRequest)
- schema_file: (optional) Which schema file to search in. Options: "metadata" (default), "apex", "both". If not specified, searches in metadata.xml first, then apex.xml if not found.

The tool will search for:
- complexType definitions (e.g., <xsd:complexType name="DeployResult">)
- simpleType definitions (e.g., <xsd:simpleType name="DeployProblemType">)
- element definitions (e.g., <xsd:element name="compileAndTest">)
- message definitions (e.g., <message name="compileAndTestRequest">)
- operation definitions (e.g., <operation name="compileAndTest">)

Returns: The raw XML schema definition for the requested component

Usage:
<retrieve_schema>
<component_name>ComponentName</component_name>
<schema_file>schema_file_name</schema_file>
</retrieve_schema>

Example: Retrieve DeployResult schema from metadata API
<retrieve_schema>
<component_name>DeployResult</component_name>
</retrieve_schema>

Example: Retrieve CompileAndTestRequest schema from apex API
<retrieve_schema>
<component_name>CompileAndTestRequest</component_name>
<schema_file>apex</schema_file>
</retrieve_schema>

Example: Search for RunTestsRequest in both files
<retrieve_schema>
<component_name>RunTestsRequest</component_name>
<schema_file>both</schema_file>
</retrieve_schema>

Example: Retrieve FileProperties schema
<retrieve_schema>
<component_name>FileProperties</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

Example: Retrieve ExecuteAnonymousResult schema
<retrieve_schema>
<component_name>ExecuteAnonymousResult</component_name>
<schema_file>apex</schema_file>
</retrieve_schema>`
}
