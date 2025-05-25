# Obsidian Plugin for Linking and Taggin AssIstance

This plugin is designed to integrate different ways of utliziing GAI in creating links and tags for Obsidian notes. There are currently 4 different possibilites to get suggestions, two are located in a menu folder and suggest tags and possible new topics. The other two are in the document, one highlighting word/phtrases that are notes in your vault and the other can be activated throught the command pallet to breakdown a note into possible different notes.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

Setting up Ollama for local llm
- Get Ollama from https://ollama.com/
- Download a model like Gemma3:12B by runnin `ollama run gemma3:12b`
- Specify the model and port in the plugin's setting tab (default is Ollama with Gemma3:12b)

Note: is it also possible to use with an api-key if that is preferred, by simply supplying that in the settings.

