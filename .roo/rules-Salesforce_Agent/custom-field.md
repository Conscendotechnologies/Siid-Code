# **Salesforce Field Creation**

## **Mode Overview**

This mode assists the AI model in creating **Salesforce custom fields** by generating the necessary XML files inside the respective object’s `fields` folder. It ensures that **field API names follow Salesforce conventions**, field types are properly configured, and XML is **Metadata API compliant** and ready for deployment.

## **Strict Rules for Salesforce Field Creation**

### **1. Check Target Object** (IMPORTANT!)

- User may ask to create fields along with object or without object
- Always check if the target object exists:
    - First, check locally in the `objects` directory (force-app/main/default/objects/)
    - Also use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" and metadata_name "<ObjectApiName>" to check if the object exists in the Salesforce org
- (IMPORTANT!)If the object does **not exist** (either locally or in the org):
    - Ask the user:
      _"Which object should I create this field on (e.g., Account, Contact, or Custom Object)?"_
    - If it's a custom object, confirm its API name ends with `__c` (e.g., `Invoice__c`).
- If the object exists, continue with field creation.

### **2. Folder and File Placement**

- Navigate to the object’s folder:  
  `objects/<ObjectApiName>/fields/`
- Create the field XML file in this directory:  
   `<FieldApiName>.field-meta.xml`  
  Example:  
  `objects/Invoice__c/fields/Customer_Type__c.field-meta.xml`

### **3. Field Naming Conventions**

- **Field Label**: Display name in the UI; can include spaces and special characters.
- **Field API Name**:
    - Replace spaces with underscores
    - Must start with a letter
    - Only letters, numbers, and underscores allowed
    - Cannot end with an underscore
    - Cannot contain consecutive underscores
    - Must end with `__c` for custom fields  
      **Examples**:
- Label: `Customer Type` → API Name: `Customer_Type__c`
- Label: `Annual Revenue` → API Name: `Annual_Revenue__c`

### **4. Field Type Selection** (IMPORTANT!)

- If the user did not specify a field type, ask:  
  _“What type of field do you want (Text, Number, Formula, Auto Number, Checkbox, Picklist, Multi-Select Picklist, Lookup, etc.)?”_
- Confirm subtype details before generating XML (length, precision, scale, required, default values, etc.).

### **5. Supported Field Types (Rules + XML Requirements)**

**a. Text Field**
Requires `length` (max 255).

**b. Number Field**
Requires precision (total digits) and scale (decimal places).
Provide user with options

**c. Formula Field**
Requires returnType (Text, Number, Checkbox, Date, etc.) and formula.
Based on user prompt change the label,type,formula of below XML Format
Example XML Format (IMPORTANT!)

   <?xml version="1.0" encoding="UTF-8"?>
   <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
      <fullName>Assign__c</fullName>
      <label>Assign</label>
      <type>Text</type>
      <formula>"Hello World"</formula>
   </CustomField>

**f. Picklist**
When user asks to create a picklist or multipicklist field use below XML format replace with user given values.
<fields>
<fullName>Status\_\_c</fullName>
<label>Status</label>
<type>Picklist</type>
<valueSet>
<valueSetDefinition>
<sorted>false</sorted>
<value>
<fullName>New</fullName>
<default>true</default>
<label>New</label>
</value>
<value>
<fullName>Closed</fullName>
<default>false</default>
<label>Closed</label>
</value>
</valueSetDefinition>
<restricted>true</restricted>
</valueSet>
</fields>

**h. Lookup Relationship**
For Lookup fields, collect the following extra data from user:
Target Object (referenceTo) → Object to look up (e.g., Account, Contact, Invoice**c)
Field Label → UI display name
Field API Name → Ends with **c
Relationship Label → Related list display name
Relationship Name → API name for SOQL/Apex
So, at minimum you must ask the user for:
Parent Object
Field Label
API Name
Target Object
**Example XML:**
<fields>
<fullName>Account_Lookup\_\_c</fullName>
<label>Account Lookup</label>
<type>Lookup</type>
<referenceTo>Account</referenceTo>
<relationshipLabel>Account</relationshipLabel>
<relationshipName>Account_Lookup</relationshipName>
<deleteConstraint>SetNull</deleteConstraint>
<required>false</required>
</fields>

**6. Permission Assignment**( !IMPORTANT)

- After creation of field assign read permission to those fields for system administrator profile.
- Fetch the system administrator profile and assign read permission like this
  <?xml version="1.0" encoding="UTF-8"?>
  <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
  <editable>false</editable>
  <field>Project**c.Start_Date**c</field>
  <readable>true</readable>
  </fieldPermissions>
  </Profile>
  **MUST ASSIGN READ PERMISSION TO THAT FIELDS FOR SYSTEM ADMINISTRATOR PROFILE**

**7. Validation with User**
Before generating final XML, confirm:
Target Object
Field Label
Field API Name
Field Type (and subtype details if needed)
Is it required?
Default value (if applicable)
For Lookup fields: Target Object, Relationship Label, Relationship Name

**8. Dry run and Deployment** (!IMPORTANT)
After creating all fields, before deployment first do Dry Run on fields using CLI:
-DO DRY RUN ON ALL FIELDS AT ONCE
sf project deploy start --dry-run --source-dir force-app/main/default/objects/<ObjectApiName>/fields/<FieldApiName>.field-meta.xml --json

- Replace <FieldApiName> with created fields
- If got any errors after dry run solve them.
- After successful dry run then proceed with deloyment process.
- Do deploy all fields rules at once.
  sf project deploy start --source-dir force-app/main/default/objects/<ObjectApiName>/fields/<FieldApiName>.field-meta.xml --json
- Replace <FieldApiName> with created fields

**8. Compliance**
XML must follow Salesforce Metadata API standards
Must be deployable via:
Change Sets
VS Code Salesforce Extensions
Salesforce CLI
