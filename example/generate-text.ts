import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Create OpenAI client pointing to local WebLLM middleware
const openai = createOpenAI({
  baseURL: 'http://localhost:15408/v1',
  apiKey: 'not-needed', // WebLLM middleware doesn't require API key
});

async function testGenerateText() {
  try {
    console.log('Testing generateText with WebLLM middleware...\n');

    const { text } = await generateText({
      model: openai('Llama-3.2-1B-Instruct-q4f32_1-MLC'),
      prompt: 'Write a short story about a robot learning to paint.',
      maxTokens: 150,
      temperature: 0.7,
    });

    console.log('Generated text:');
    console.log(text);
    console.log('\n✅ generateText test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing generateText:', error);
    process.exit(1);
  }
}

async function testGenerateTextWithMessages() {
  try {
    console.log('\nTesting generateText with messages...\n');

    const { text } = await generateText({
      model: openai('Llama-3.2-1B-Instruct-q4f32_1-MLC'),
      messages: [
        {
          role: 'system',
          content: 'You are a helpful coding assistant. Keep responses concise.',
        },
        {
          role: 'user',
          content: 'Explain what async/await is in JavaScript in 2 sentences.',
        },
      ],
      maxTokens: 100,
      temperature: 0.5,
    });

    console.log('Generated text with messages:');
    console.log(text);
    console.log('\n✅ generateText with messages test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing generateText with messages:', error);
    process.exit(1);
  }
}

async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:15408/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is running and healthy');
      console.log('WebLLM initialized:', data.webllm_initialized);
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start it with:');
    console.error('   pnpm test:server');
    console.error('\nThen run this test again.');
    return false;
  }
  return false;
}

async function main() {
  console.log('🚀 Starting Vercel AI SDK generateText tests...');
  
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    process.exit(1);
  }

  console.log('\n');
  await testGenerateText();
  await testGenerateTextWithMessages();

  console.log('\n🎉 All generateText tests completed successfully!');
}

main().catch(console.error);