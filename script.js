// Load environment variables from .env file
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CONVERSATION_ASSISTANT_ID = process.env.CONVERSATION_ASSISTANT_ID;
const FEEDBACK_ASSISTANT_ID = process.env.FEEDBACK_ASSISTANT_ID;

let selectedScenario = '';
let isRecording = false;
let recognition;
let isSpeaking = false;  // Flag to indicate if TTS is active

document.getElementById('select-patient').addEventListener('click', selectPatient);
document.getElementById('start-audio-conversation').addEventListener('click', toggleAudioConversation);
document.getElementById('user-input').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        enterText();
    }
});
document.getElementById('end-session').addEventListener('click', endSession);

function selectPatient() {
    const scenarios = [
        'John Deer is a 66 year old male with end-stage COPD who has lost 20% of his body weight in the last 3 months and has been to the hospital 4 times in the last 6 months for COPD exacerbations.'
    ];
    selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    displayScenario(selectedScenario);
}

function displayScenario(scenario) {
    const conversationScript = document.getElementById('conversation-script');
    conversationScript.innerHTML = ''; // Clear any existing content
    const scenarioEntry = document.createElement('div');
    scenarioEntry.textContent = `Scenario: ${scenario}`;
    scenarioEntry.style.fontWeight = 'bold';
    conversationScript.appendChild(scenarioEntry);
}

function toggleAudioConversation() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Your browser does not support Speech Recognition. Please use Google Chrome.');
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        if (isSpeaking) return;  // Do not process if TTS is active
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                enterText(event.results[i][0].transcript);
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        document.getElementById('user-input').value = interimTranscript;
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error detected: ' + event.error);
    };

    recognition.onend = function() {
        if (isRecording && !isSpeaking) {
            recognition.start();
        }
    };

    recognition.start();
    isRecording = true;
    document.getElementById('start-audio-conversation').textContent = 'Stop Audio Conversation';
}

function stopRecording() {
    if (recognition) {
        recognition.stop();
        isRecording = false;
        document.getElementById('start-audio-conversation').textContent = 'Start Audio Conversation';
    }
}

function enterText(text) {
    const userInput = text || document.getElementById('user-input').value;
    if (userInput.trim()) {
        addUserInputToScript(userInput);
        document.getElementById('user-input').value = '';  // Clear the textarea
        console.log('User input:', userInput);  // Debugging log
        getAssistantResponse(userInput);  // Get the assistant's response
    }
}

function addUserInputToScript(text) {
    const conversationScript = document.getElementById('conversation-script');
    const userEntry = document.createElement('div');
    userEntry.className = 'user-text';
    userEntry.textContent = `User: ${text}`;
    conversationScript.appendChild(userEntry);
    conversationScript.scrollTop = conversationScript.scrollHeight; // Auto-scroll
}

function getAssistantResponse(userInput) {
    console.log('Sending request to API...');  // Debugging log
    fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`  // Use your OpenAI API key
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are role playing as a patient who is seriously ill. You are role-playing as the following patient scenario: ${selectedScenario}. assistant ID ${CONVERSATION_ASSISTANT_ID}. Use simple, everyday language and avoid clinical terms.`
                },
                { role: 'user', content: userInput }
            ],
            max_tokens: 150,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.6
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Data:', data);  // Debugging log
        if (data && data.choices && data.choices.length > 0) {
            const assistantResponse = data.choices[0].message.content.trim();
            addAssistantResponseToScript(assistantResponse);
            // speakResponse(assistantResponse);  // Commented out
        } else {
            console.error('Invalid response from assistant API');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function addAssistantResponseToScript(text) {
    const conversationScript = document.getElementById('conversation-script');
    const assistantEntry = document.createElement('div');
    assistantEntry.className = 'assistant-text';
    assistantEntry.textContent = `Assistant: ${text}`;
    conversationScript.appendChild(assistantEntry);
    conversationScript.scrollTop = conversationScript.scrollHeight; // Auto-scroll
}

function endSession() {
    const conversationScript = document.getElementById('conversation-script');
    const conversationText = conversationScript.innerText;

    console.log('Sending feedback request to API...');  // Debugging log
    fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`  // Use your OpenAI API key
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant that has access to specific files and knowledge base associated with the assistant ID ${FEEDBACK_ASSISTANT_ID}. Provide feedback based on the following conversation and how well the user followed the serious illness guide. Also, provide feedback on how to improve the empathy of the conversation: ${conversationText}`
                }
            ],
            max_tokens: 150,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.6
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Feedback data:', data);  // Debugging log
        if (data && data.choices && data.choices.length > 0) {
            displayFeedback(data.choices[0].message.content.trim());
        } else {
            console.error('Invalid feedback response from assistant API');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function displayFeedback(feedback) {
    const feedbackContainer = document.getElementById('feedback');
    const feedbackItems = feedback.split('. ').map(item => `<li>${item.trim()}</li>`).join('');
    feedbackContainer.innerHTML = `Conversation ended. Here is some feedback: <ul>${feedbackItems}</ul>`;
}
