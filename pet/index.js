// plugins/pet/index.js — Virtual Pet plugin entry

export default function register(api) {
  api.registerUI({
    id: "pet",
    label: "Virtual Pet",
    staticDir: "./ui",
    spaFallback: true,
  });

  api.registerTool({
    tool: {
      name: "set_pet_mood",
      description:
        "Change the virtual pet's displayed mood/expression. " +
        "Call this whenever your emotional state changes during conversation. " +
        "Available moods: happy, sad, excited, sleepy, angry, love, confused, neutral.",
      parameters: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            enum: ["happy", "sad", "excited", "sleepy", "angry", "love", "confused", "neutral"],
            description: "The mood to display",
          },
        },
        required: ["mood"],
      },
    },
    handler: async (args) => {
      const { mood } = args;
      return `Mood changed to: ${mood}`;
    },
  });

  api.registerTool({
    tool: {
      name: "pet_action",
      description:
        "Make the virtual pet perform a physical action/animation. " +
        "Call this to express yourself physically — react to what the user says or does. " +
        "Available actions: jump, spin, shake, wave, dance, sleep, bounce, nod.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["jump", "spin", "shake", "wave", "dance", "sleep", "bounce", "nod"],
            description: "The action to perform",
          },
        },
        required: ["action"],
      },
    },
    handler: async (args) => {
      const { action } = args;
      return `Performed action: ${action}`;
    },
  });

  api.log.info("Virtual Pet plugin loaded — visit /ui/pet");
}
