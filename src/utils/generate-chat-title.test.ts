import { generateChatTitle } from './generate-chat-title';

/**
 * Simple test runner for generateChatTitle
 * Can be run with: node dist/utils/generate-chat-title.test.js (after build)
 * Or integrated with Jest/Vitest
 */

interface TestCase {
  description: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  // Examples from requirements
  {
    description: 'Interview preparation example',
    input: 'Help me prepare for a React interview',
    expected: 'React Interview',
  },
  {
    description: 'React Fiber Architecture example',
    input: 'Explain React Fiber Architecture',
    expected: 'React Fiber Architecture',
  },
  {
    description: 'Node.js authentication example',
    input: 'Create a Node.js authentication system',
    expected: 'Nodejs Authentication System',
  },
  {
    description: 'OpenRouter pricing example',
    input: 'How does OpenRouter pricing work?',
    expected: 'Openrouter Pricing',
  },

  // Edge cases
  {
    description: 'Empty string',
    input: '',
    expected: 'New Chat',
  },
  {
    description: 'Only whitespace',
    input: '   ',
    expected: 'New Chat',
  },

  // Punctuation removal
  {
    description: 'Multiple punctuation marks',
    input: 'How do I???  Build a REST API!!!',
    expected: 'Rest Api',
  },
  {
    description: 'Commas and periods',
    input: 'Explain TypeScript, React, and Node.js',
    expected: 'Typescript React Nodejs',
  },

  // Filler words removal
  {
    description: 'Filler words "what" and "is"',
    input: 'What is machine learning?',
    expected: 'Machine Learning',
  },
  {
    description: 'Multiple filler words',
    input: 'Can you help me understand how JavaScript works?',
    expected: 'Understand Javascript',
  },
  {
    description: 'Filler words "for" and "a"',
    input: 'Give me a guide for Python debugging',
    expected: 'Guide Python Debugging',
  },

  // Title case conversion
  {
    description: 'Lowercase input',
    input: 'explain docker containerization',
    expected: 'Docker Containerization',
  },
  {
    description: 'Mixed case input',
    input: 'TyPeScRiPt ToUtS',
    expected: 'Typescript Touts',
  },

  // Length constraints
  {
    description: 'Very long message',
    input:
      'Create a comprehensive full stack application with authentication, database, real-time updates',
    expected: 'Comprehensive Full Stack Application',
  },
  {
    description: 'Message that exceeds 50 chars',
    input: 'How do I build a machine learning model with TensorFlow',
    expected: 'Machine Learning Model Tensorflow',
  },

  // Special characters
  {
    description: 'Parentheses removal',
    input: 'Explain (recursion) in programming',
    expected: 'Recursion Programming',
  },
  {
    description: 'Brackets and dashes',
    input: 'Build [REST] API - best practices',
    expected: 'Rest Api',
  },

  // Numbers handling
  {
    description: 'Numbers in message',
    input: 'What are the top 5 JavaScript frameworks?',
    expected: 'Javascript Frameworks',
  },
  {
    description: 'Technical version numbers',
    input: 'Upgrade to React 18 with Fiber architecture',
    expected: 'Upgrade React Fiber Architecture',
  },

  // Single word cases
  {
    description: 'Single keyword',
    input: 'JavaScript',
    expected: 'Javascript',
  },
  {
    description: 'Two word message',
    input: 'Python help',
    expected: 'Python',
  },

  // Real-world examples
  {
    description: 'Complex real-world query',
    input: 'How can I optimize my React component performance with memoization?',
    expected: 'Optimize React Component Performance Memoization',
  },
  {
    description: 'Database question',
    input: 'Explain the difference between SQL and NoSQL databases',
    expected: 'Difference Sql Nosql Databases',
  },
  {
    description: 'API design question',
    input: 'What are the best practices for designing a REST API?',
    expected: 'Designing Rest Api',
  },

  // Boundary conditions
  {
    description: 'Exactly at 50 character limit',
    input: 'Build an authentication system using JWT tokens',
    expected: 'Authentication System Jwt Tokens',
  },
  {
    description: 'Multiple spaces between words',
    input: 'Learn    TypeScript    from    scratch',
    expected: 'Learn Typescript Scratch',
  },

  // Filler word edge cases
  {
    description: 'Only filler words',
    input: 'can you help me please',
    expected: 'New Chat',
  },
  {
    description: 'Question with multiple helpers',
    input: 'How can you help me learn about algorithms?',
    expected: 'Learn Algorithms',
  },

  // Case preservation for acronyms
  {
    description: 'API in different context',
    input: 'Build REST APIs with Node.js',
    expected: 'Rest Apis Nodejs',
  },

  // Meaningful extraction
  {
    description: 'Extract key terms from verbose message',
    input: 'I need help with setting up a GraphQL server',
    expected: 'Setting Graphql Server',
  },
  {
    description: 'Technical acronyms',
    input: 'How do I integrate JWT authentication in my Node backend?',
    expected: 'Integrate Jwt Authentication Node Backend',
  },
];

let passCount = 0;
let failCount = 0;

console.log('🧪 Testing generateChatTitle utility\n');
console.log('='.repeat(70));

testCases.forEach((testCase, index) => {
  const result = generateChatTitle(testCase.input);
  const passed = result === testCase.expected;

  if (passed) {
    passCount++;
    console.log(`✅ Test ${index + 1}: ${testCase.description}`);
  } else {
    failCount++;
    console.log(`❌ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input:    "${testCase.input}"`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log('='.repeat(70));
console.log(
  `\n📊 Results: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`,
);

if (failCount === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed`);
  process.exit(1);
}
