# AI Agents & Collaborative Intelligence

Unlike generic chatbots, CodeXomics is powered by a **Multi-Agent System (MAS)**—a network of 7 specialized AI agents working together behind the scenes to perform complex genome analysis safely and effectively.

## 🧠 Meet the Agents

When you send a request in the CodeXomics ChatBox, you aren't just talking to a single LLM; you are submitting a task to the agent swarm:

1. **CoordinatorAgent**: The manager. It breaks down your prompt into sub-tasks and delegates them to the most suitable specialized agents.
2. **AnalysisAgent**: The mathematician. Handles sequence motif searching, GC content calculations, primer formulation, and deep string manipulations.
3. **DataAgent**: The librarian. Specializes in formatting sequences, exporting files (FASTA/GenBank), and retrieving external public databases.
4. **NavigationAgent**: The navigator. Interprets positional commands (_"Go to the start of the BRCA1 gene"_) and manipulates the main visualization UI.
5. **PluginAgent**: The integrator. Specifically trained to handle execution flows for any installed third-party plugins from the Marketplace.
6. **ExternalAgent**: The protocol agent. Responsible for executing tasks that require communicating with remote MCP servers.
7. **DeepResearchAgent**: The researcher. A highly capable agent specifically spun up for unbounded research loops requiring multi-step web and database probing.

## 🪄 Smart Execution Flow

When you ask: _"Analyze the sequence from chromosome 1 and jump to the longest open reading frame"_:

1. **Routing Strategy**: The CoordinatorAgent scores the prompt using `calculateAgentScore`.
2. **Phase 1 (Analysis)**: The AnalysisAgent runs the `analyze_sequence` tool in the background to return reading frames.
3. **Phase 2 (Navigation)**: The NavigationAgent takes the resulting output bounds and natively moves your camera position to the exact nucleotides on the screen.
4. **Caching**: If you ask a similar identical question later, the agents instantly respond via memory blocks rather than burning token usage repeating execution.

## 💬 Monitoring Agent Thoughts

You can observe these agents collaborating in real time! Inside the AI chat panel, click the **Thinking Process** dropdown on a message block to trace exactly which agent picked up the task, which tools they used, and how they passed information back and forth.
