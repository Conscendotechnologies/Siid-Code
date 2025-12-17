// npx vitest src/core/tools/__tests__/retrieveSchemaTool.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import * as path from "path"

// Mock dependencies
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((error: string) => `Tool error: ${error}`),
	},
}))

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		access: vi.fn(),
	},
	readFile: vi.fn(),
	access: vi.fn(),
}))

// Sample XML schemas for testing
const SAMPLE_METADATA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions targetNamespace="http://soap.sforce.com/2006/04/metadata">
 <types>
  <xsd:schema elementFormDefault="qualified" targetNamespace="http://soap.sforce.com/2006/04/metadata">
   <xsd:complexType name="DeployResult">
    <xsd:sequence>
     <xsd:element name="id" type="tns:ID"/>
     <xsd:element name="details" type="tns:DeployDetails"/>
     <xsd:element name="success" type="xsd:boolean"/>
    </xsd:sequence>
   </xsd:complexType>
   <xsd:complexType name="DeployDetails">
    <xsd:sequence>
     <xsd:element name="componentFailures" minOccurs="0" maxOccurs="unbounded" type="tns:DeployMessage"/>
    </xsd:sequence>
   </xsd:complexType>
   <xsd:simpleType name="DeployStatus">
    <xsd:restriction base="xsd:string">
     <xsd:enumeration value="Pending"/>
     <xsd:enumeration value="InProgress"/>
     <xsd:enumeration value="Succeeded"/>
    </xsd:restriction>
   </xsd:simpleType>
   <xsd:element name="deploy">
    <xsd:complexType>
     <xsd:sequence>
      <xsd:element name="ZipFile" type="xsd:base64Binary"/>
     </xsd:sequence>
    </xsd:complexType>
   </xsd:element>
  </xsd:schema>
 </types>
 <message name="deployRequest">
  <part element="tns:deploy" name="parameters"/>
 </message>
 <portType name="MetadataPortType">
  <operation name="deploy">
   <documentation>Deploy metadata to an org</documentation>
   <input message="tns:deployRequest"/>
  </operation>
 </portType>
</definitions>`

const SAMPLE_APEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions targetNamespace="http://soap.sforce.com/2006/08/apex">
 <types>
  <xsd:schema elementFormDefault="qualified" targetNamespace="http://soap.sforce.com/2006/08/apex">
   <xsd:complexType name="CompileAndTestRequest">
    <xsd:sequence>
     <xsd:element name="checkOnly" type="xsd:boolean"/>
     <xsd:element name="runTestsRequest" minOccurs="0" type="tns:RunTestsRequest"/>
    </xsd:sequence>
   </xsd:complexType>
   <xsd:complexType name="RunTestsRequest">
    <xsd:sequence>
     <xsd:element name="allTests" type="xsd:boolean"/>
     <xsd:element name="tests" minOccurs="0" maxOccurs="unbounded" type="tns:TestsNode"/>
    </xsd:sequence>
   </xsd:complexType>
  </xsd:schema>
 </types>
</definitions>`

// Import after mocks
import { retrieveSchemaTool } from "../retrieveSchemaTool"
import * as fs from "fs/promises"

describe("retrieveSchemaTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()

		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, value?: string) => value || "")

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			ask: vi.fn(),
			cwd: "/test/project",
		}

		// Setup default mocks for fs module
		vi.mocked(fs.readFile).mockImplementation((filePath: any) => {
			const fileName = path.basename(filePath as string)
			if (fileName === "metadata.xml") {
				return Promise.resolve(SAMPLE_METADATA_XML) as any
			} else if (fileName === "apex.xml") {
				return Promise.resolve(SAMPLE_APEX_XML) as any
			}
			return Promise.reject(new Error("File not found"))
		})

		vi.mocked(fs.access).mockResolvedValue(undefined as any)
	})

	describe("parameter validation", () => {
		it("should handle missing component_name parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					schema_file: "metadata",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing component_name error")

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("retrieve_schema")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("retrieve_schema", "component_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing component_name error")
		})

		it("should handle invalid schema_file parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "invalid",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("retrieve_schema")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Invalid schema_file parameter: invalid"),
			)
		})
	})

	describe("partial requests", () => {
		it("should handle partial streaming requests", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "metadata",
				},
				partial: true,
			}

			mockTask.ask = vi.fn().mockResolvedValue(true)

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.ask).toHaveBeenCalledWith("tool", expect.stringContaining("retrieveSchema"), true)
		})
	})

	describe("complexType schema retrieval", () => {
		it("should retrieve DeployResult complexType from metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployResult"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Salesforce Metadata API v65.0"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("```xml"))
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Referenced types in this definition: ID, DeployDetails"),
			)
		})

		it("should retrieve CompileAndTestRequest complexType from apex.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "CompileAndTestRequest",
					schema_file: "apex",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("CompileAndTestRequest"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Salesforce Apex API v65.0"))
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Referenced types in this definition: RunTestsRequest"),
			)
		})

		it("should retrieve DeployDetails and detect nested types", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployDetails",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployDetails"))
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Referenced types in this definition: DeployMessage"),
			)
		})
	})

	describe("simpleType schema retrieval", () => {
		it("should retrieve DeployStatus simpleType from metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployStatus",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployStatus"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<xsd:simpleType"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Pending"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Succeeded"))
		})
	})

	describe("element schema retrieval", () => {
		it("should retrieve deploy element from metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "deploy",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("deploy"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<xsd:element"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("ZipFile"))
		})
	})

	describe("message and operation retrieval", () => {
		it("should retrieve deployRequest message from metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "deployRequest",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("deployRequest"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<message"))
		})

		it("should retrieve deploy operation from metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "deploy",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should find the element first (elements take precedence in search order)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("deploy"))
		})
	})

	describe("searching both files", () => {
		it("should search both files and find component in metadata", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "both",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployResult"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Salesforce Metadata API v65.0"))
		})

		it("should search both files and find component in apex", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "RunTestsRequest",
					schema_file: "both",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("RunTestsRequest"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Salesforce Apex API v65.0"))
		})
	})

	describe("component not found", () => {
		it("should handle component not found in metadata.xml", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "NonExistentComponent",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Component 'NonExistentComponent' not found"),
			)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("metadata.xml"))
		})

		it("should handle component not found in both files", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "NonExistentComponent",
					schema_file: "both",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Component 'NonExistentComponent' not found"),
			)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("both metadata.xml and apex.xml"))
		})
	})

	describe("default behavior", () => {
		it("should default to metadata.xml when schema_file is not specified", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployResult"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Salesforce Metadata API v65.0"))
		})
	})

	describe("execution without approval", () => {
		it("should execute directly without asking for approval", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should not ask for approval
			expect(mockAskApproval).not.toHaveBeenCalled()
			// Should execute and return result
			expect(mockPushToolResult).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployResult"))
		})
	})

	describe("error handling", () => {
		it("should handle file not found error", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "metadata",
				},
				partial: false,
			}

			// Mock file not found
			vi.mocked(fs.access).mockImplementation(() => {
				const error: NodeJS.ErrnoException = new Error("File not found")
				error.code = "ENOENT"
				return Promise.reject(error)
			})

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("retrieving XML schema", expect.any(Error))
		})

		it("should handle unexpected errors during execution", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "DeployResult",
					schema_file: "metadata",
				},
				partial: false,
			}

			const error = new Error("Unexpected error during file read")
			// Mock fs.readFile to throw an error
			vi.mocked(fs.readFile).mockRejectedValue(error)

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("retrieving XML schema", error)
		})
	})

	describe("case sensitivity", () => {
		it("should handle case-insensitive component search", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "retrieve_schema",
				params: {
					component_name: "deployresult", // lowercase
					schema_file: "metadata",
				},
				partial: false,
			}

			await retrieveSchemaTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should find it because regex has 'i' flag
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("DeployResult"))
		})
	})
})
