import dotenv from 'dotenv'
import fastify from 'fastify'
import random from 'lodash/random'
import shuffle from 'lodash/shuffle'
import { Configuration, OpenAIApi } from 'openai'

dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(configuration)

const trimAndRemoveDoubleQuotes = (str: string) =>
  str.trim().replaceAll('"', '')

const app = fastify()

app.get<{ Querystring: { topics?: Array<string>; title?: string } }>(
  '/ai-powered-flashcards',
  async (request, reply) => {
    let generatedJsonString: string | undefined
    const { topics, title } = request.query

    if (!topics?.length || !title) {
      reply
        .status(400)
        .send({ message: 'É necessário informar os tópicos e o título.' })
    }

    try {
      const amountOfCards = 3
      const charactersPerSentence = 65

      /**
       * Selects between 1 and 3 random topics from the array of topics
       * and build a string with the topics separated by 'ou'
       */
      const joinedTopics = shuffle(topics).slice(0, random(1, 3)).join(' ou ')

      /** Build prompt asking OpenAI to generate a csv string */
      const prompt = `Levando em conta o contexto ${title}, gere um Array JSON de tamanho ${amountOfCards} com perguntas e respostas curtas e diretas, de no máximo ${charactersPerSentence} caracteres, sobre ${joinedTopics}. [{question: "pergunta", answer: "resposta"}, ...]`

      const response = await openai.createChatCompletion(
        {
          n: 1,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          model: 'gpt-3.5-turbo',
          max_tokens: amountOfCards * charactersPerSentence,
        },
        { timeout: 30_000 }
      )

      generatedJsonString = response.data.choices[0]?.message?.content

      if (!generatedJsonString) {
        throw new Error('Não foi possível gerar as perguntas e respostas.')
      }

      const generatedJson = JSON.parse(generatedJsonString)

      const cards = generatedJson.map(
        ({ question, answer }: { question: string; answer: string }) => ({
          question: trimAndRemoveDoubleQuotes(question),
          validAnswers: trimAndRemoveDoubleQuotes(answer),
          isAiPowered: true,
        })
      )

      return cards
    } catch (error) {
      reply
        .status(500)
        .send({ message: 'Erro inesperado ao gerar os cards', error })
    }
  }
)

app
  .listen({
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.log('🚀 HTTP server running')
  })
