# Plugin Integration & Marketplace

CodeXomics features a robust plugin architecture that allows both the user and the Multi-Agent System to seamlessly discover, install, and execute modular biological analysis tools.

## 🛍️ The Plugin Marketplace

The **Plugin Marketplace** is built directly into CodeXomics and serves as the central hub for extending your application's capabilities.

### How to Access the Marketplace

1. Open up CodeXomics and locate the **Marketplace** icon in the main sidebar or preferences menu.
2. Ensure you have the `marketplace-server` successfully running (this usually runs automatically if you started CodeXomics with `npm run start-full`).

### Installing Plugins

1. Browse through the available list of extensions (ranging from comparative genomics mapping to metabolic pathway visualization).
2. Click **Install** on any plugin that fits your workflow.
3. _Note_: The application handles the registration automatically! The plugin is immediately patched into the **Dynamic Tool Registry**, making it accessible to the AI.

## 🤖 AI Integration with Plugins

The main advantage of CodeXomics plugins is **Zero-Configuration UI/AI Integration**.

When a plugin is installed:

1. It registers an executable JSON schema that defines its inputs and capabilities.
2. The internal **PluginAgent** instantly reads these capabilities.
3. The next time you ask the AI to perform a task (e.g., _"Generate a protein-protein interaction network for this sequence"_), the AI scans the registry, detects the newly installed plugin, and autonomously executes its tools without you ever pushing a manual button.

## Managing Your Plugins

You can disable or uninstall plugins at any time:

- Navigate to the **Installed Plugins** tab inside the Marketplace or Settings.
- Toggle the switch to temporarily disable a plugin (hiding it from the AI's toolkit).
- Click **Uninstall** to permanently remove the tool from your environment.
