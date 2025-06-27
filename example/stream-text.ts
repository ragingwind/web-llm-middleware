import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Create OpenAI client pointing to local WebLLM middleware
const openai = createOpenAI({
  baseURL: 'http://localhost:15408/v1',
  apiKey: 'not-needed', // WebLLM middleware doesn't require API key
});

async function testStreamText() {
  try {
    console.log('Testing streamText with WebLLM middleware...\n');

    const { textStream } = await streamText({
      model: openai('Llama-3.2-1B-Instruct-q4f32_1-MLC'),
      prompt: 'Write a creative short story about a time-traveling cat.',
      maxTokens: 200,
      temperature: 0.8,
    });

    console.log('Streaming text:');
    let fullText = '';
    
    for await (const textPart of textStream) {
      process.stdout.write(textPart);
      fullText += textPart;
    }

    console.log('\n\n✅ streamText test completed successfully!');
    console.log(`\nFull text length: ${fullText.length} characters`);
  } catch (error) {
    console.error('❌ Error testing streamText:', error);
    process.exit(1);
  }
}

async function testStreamTextWithMessages() {
  try {
    console.log('\n\nTesting streamText with messages...\n');

    const { textStream } = await streamText({
      model: openai('Llama-3.2-1B-Instruct-q4f32_1-MLC'),
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains complex topics simply.',
        },
        {
          role: 'user',
          content: 'Explain quantum computing to a 10-year-old.',
        },
      ],
      maxTokens: 150,
      temperature: 0.6,
    });

    console.log('Streaming explanation:');
    let fullText = '';
    
    for await (const textPart of textStream) {
      process.stdout.write(textPart);
      fullText += textPart;
    }

    console.log('\n\n✅ streamText with messages test completed successfully!');
    console.log(`\nFull text length: ${fullText.length} characters`);
  } catch (error) {
    console.error('❌ Error testing streamText with messages:', error);
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
  console.log('🚀 Starting Vercel AI SDK streamText tests...');
  
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    process.exit(1);
  }

  console.log('\n');
  await testStreamText();
  await testStreamTextWithMessages();

  console.log('\n🎉 All streamText tests completed successfully!');
}

main().catch(console.error);