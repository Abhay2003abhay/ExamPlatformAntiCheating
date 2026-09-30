const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function generateQuestions(topic, numQuestions = 5) {
    const prompt = `
        You are an expert in creating educational content. Your task is to generate a series of multiple-choice questions (MCQs) on a given topic.
        The output must be a valid JSON array of objects. Each object represents a single question and must have the following structure:
        {
            "questionText": "The text of the question.",
            "options": [
                { "optionIndex": "A", "optionText": "Text for option A" },
                { "optionIndex": "B", "optionText": "Text for option B" },
                { "optionIndex": "C", "optionText": "Text for option C" },
                { "optionIndex": "D", "optionText": "Text for option D" }
            ],
            "correctAnswer": "The optionIndex of the correct answer (e.g., 'A')",
            "marks": 1
        }

        Please adhere to the following rules:
        1.  The response MUST be ONLY the JSON array. Do not include any introductory text, explanations, or markdown formatting like 
        2.  Ensure the JSON is well-formed and can be parsed directly.
        3.  Generate exactly ${numQuestions} questions.
        4.  The topic for the questions is: "${topic}".
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'openai/gpt-oss-20b',
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 1,
            stream: false, // Important: Do not stream for JSON parsing
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Groq API returned an empty response.');
        }

        // The model might return a JSON object with a key containing the array.
        // We need to handle that and extract the array.
        let questions;
        try {
            const parsedContent = JSON.parse(content);
            // Check if the parsed content is an array or an object with a key containing the array
            if (Array.isArray(parsedContent)) {
                questions = parsedContent;
            } else if (typeof parsedContent === 'object' && parsedContent !== null) {
                const keys = Object.keys(parsedContent);
                if (keys.length > 0 && Array.isArray(parsedContent[keys[0]])) {
                    questions = parsedContent[keys[0]];
                }
            }

            if (!questions) {
                 console.error('Could not extract questions array from Groq response:', content);
                 throw new Error('Failed to parse questions from Groq response.');
            }

        } catch (parseError) {
            console.error('Error parsing JSON from Groq:', parseError);
            console.error('Raw response from Groq:', content);
            throw new Error('Invalid JSON response from Groq API.');
        }


        // Basic validation of the returned structure
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Generated content is not a valid array of questions.');
        }

        // Add question numbers
        return questions.map((q, index) => ({ ...q, questionNumber: index + 1 }));

    } catch (error) {
        console.error('Error generating questions with Groq:', error);
        throw new Error('Failed to generate questions using Groq API.');
    }
}

module.exports = { generateQuestions };
