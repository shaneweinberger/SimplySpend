import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const payload = await req.json()
  const newUser = payload.record // This is the new row from public.profiles

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'SimplySpend <system@simplyspend.ca>',
      to: ['dev.shanewein@gmail.com'],
      subject: '🚀 New User Signup: ' + newUser.email,
      html: `
        <h1>New User Alert!</h1>
        <p><strong>Email:</strong> ${newUser.email}</p>
        <p><strong>Name:</strong> ${newUser.first_name} ${newUser.last_name}</p>
        <p><strong>Signed up at:</strong> ${new Date().toLocaleString()}</p>
      `,
    }),
  })

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
