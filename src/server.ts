import './config-env'

import fastify from 'fastify'
import cors from '@fastify/cors'
import random from 'lodash/random'
import shuffle from 'lodash/shuffle'

import { openai } from './openai'
import { trimAndRemoveDoubleQuotes } from './utils'

const app = fastify()

app.register(cors, {
  origin: (origin, cb) => {
    const error = () => cb(new Error(''), false)

    if (!origin) return cb(null, true)

    const allowedHosts = ['localhost', 'dev.briskly.app', 'briskly.app']
    const originHostname = new URL(origin).hostname

    if (allowedHosts.includes(originHostname)) {
      cb(null, true)
      return
    }

    error()
  },
})

app.get('/healthcheck', async (_, reply) => {
  reply.status(200).send({ message: 'OK' })
})

app.get<{
  Querystring: { topics?: Array<string>; title?: string; something: string }
}>('/ai-powered-flashcards', async (request, reply) => {
  let generatedJsonString: string | undefined
  const { topics, title, something } = request.query

  if (!topics?.length || !title) {
    reply
      .status(400)
      .send({ message: 'É necessário informar os tópicos e o título.' })
  }

  try {
    console.log(something[10].toString())

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
    console.log('Error: ', JSON.stringify(error).replaceAll('\n', ''))
    reply
      .status(500)
      .send({ message: 'Erro inesperado ao gerar os cards', error })
  }
})

app
  .listen({
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.log('🚀 HTTP server running')
  })
