# Salesforce Deployment Guidelines (High Priority)

Priority: HIGH

These rules guide the agent when planning or executing Salesforce metadata deployments.

## Core principles

- Deploy only changed components, not entire folders.
- Use the modern Salesforce CLI `sf` commands, not legacy `sfdx`.
- Prefer manifest- or metadata-type-targeted deploys that include only components detected as changed.
- Validate first (check-only) when appropriate; run minimal, relevant tests.

## Compatibility with existing component guides

- This document sets deployment strategy and CLI usage. It does not override component-specific creation, structure, or metadata rules in:
    - `.roo/rules-code/apex-guide.md`
    - `.roo/rules-code/lwc-guide.md`
    - `.roo/rules-Salesforce_Agent/*` (custom-object, custom-field, assignment-rules, field-permissions, etc.)
- When a component guide requires immediate deployment (e.g., after creating a profile, queue, or tab), follow that requirement but still:
    - Use `sf` CLI commands (not `sfdx`).
    - Deploy only the changed component(s) rather than the entire folder.
    - Prefer `--check-only` (dry run) first when not explicitly prohibited, then perform the actual deploy.
    - Run minimal, relevant tests (e.g., apex tests impacted by the change).

## Detecting changed components

- Compute the delta from your default branch or last commit:
    - Use `git diff --name-only` to list changed files in `force-app/**`.
    - Map changed file paths to metadata types (e.g., ApexClass, ApexTrigger, AuraDefinitionBundle, LWC, CustomObject, etc.).
    - Optionally generate a dynamic `package.xml` manifest that includes only changed components.

## Command guidance (use `sf`, not `sfdx`)

- Validate deploy (check-only) for a specific component/dir:

    - Windows PowerShell examples:

        ```powershell
        # Deploy a single component by metadata type
        sf project deploy start -m ApexClass:MyClass -c --target-org MyAlias

        # Deploy from source directory (only changed files staged in the dir)
        sf project deploy start --source-dir force-app/main/default/classes -c --target-org MyAlias

        # Deploy using manifest (package.xml with only changed components)
        sf project deploy start --manifest manifest/package.xml -c --target-org MyAlias
        ```

- Execute deploy (non-check-only) with minimal tests:

    ```powershell
    # Run local tests only (recommended for speed unless org policies require more)
    sf project deploy start --manifest manifest/package.xml --test-level RunLocalTests --target-org MyAlias

    # Run specific tests impacted by changes
    sf project deploy start --manifest manifest/package.xml --tests MyClassTest,AnotherTest --target-org MyAlias
    ```

- Retrieve and source tracking (for completeness):

    ```powershell
    # Retrieve only changed components defined in a manifest
    sf project retrieve start --manifest manifest/package.xml --target-org MyAlias

    # Pull source tracking changes (scratch orgs)
    sf project retrieve start --source-dir force-app --target-org MyAlias
    ```

## Packaging only changed components

- If a manifest is required, generate a dynamic `package.xml` from the delta set.
- Include only metadata members corresponding to changed paths.
- Avoid using `--source-dir force-app` at the repo root without filtering—it will deploy the whole folder.

## Testing strategy

- Default to `RunLocalTests` unless org or compliance requires `RunAllTestsInOrg`.
- For Apex, select only impacted test classes when possible (e.g., based on dependency mapping).
- Use `--check-only` to validate prior to a full deploy in CI.

## Do NOT

- Do not use `sfdx` commands in new scripts—use `sf`.
- Do not deploy entire `force-app` when only a few components changed.
- Do not run all tests for trivial changes unless required by policy.

## Notes

- These rules are intended for CI pipelines and local deploy flows.
- The agent should prefer delta-based deploys and provide explicit component lists.
- When unsure of metadata type mappings, the agent should propose a generated `package.xml` containing only changed items.
