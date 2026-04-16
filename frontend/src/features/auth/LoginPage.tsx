import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, Route } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { login } from '../../lib/api';
import { useAuthStore } from '../../store/auth-store';

const schema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha obrigatoria')
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'admin@settelog.local',
      password: 'admin123'
    }
  });

  async function onSubmit(values: LoginForm) {
    setError(undefined);
    try {
      const session = await login(values.email, values.password);
      setSession(session);
      navigate('/');
    } catch {
      setError('Não foi possivel autenticar. Verifique API, seed e credenciais.');
    }
  }

  return (
    <main className="grid min-h-screen bg-[#10120f] text-white lg:grid-cols-[1.1fr_0.9fr]">
      <section
        className="relative hidden min-h-screen overflow-hidden lg:block"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(16,18,15,0.88), rgba(16,18,15,0.18)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-x-0 bottom-0 p-12">
          <div className="max-w-2xl">
            <span className="mb-6 inline-flex rounded-md border border-white/30 px-3 py-1 text-sm text-white/90">
              Telemetria, rotas, custos e compliance
            </span>
            <h1 className="text-5xl font-semibold leading-tight">Operação de frota com controle total.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              Dados operacionais, alertas criticos e desempenho financeiro em uma central segura para times de frota.
            </p>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md border-white/10 bg-white p-6 text-fleet-ink shadow-soft">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-fleet-green text-white">
              <Route size={24} />
            </div>
            <div>
              <strong className="block text-xl font-semibold">SETTE Log</strong>
              <span className="text-sm text-zinc-500">Acesso administrativo</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                <Input id="email" className="pl-10" autoComplete="email" {...register('email')} />
              </div>
              {errors.email && <p className="mt-1 text-sm text-fleet-red">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="password">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                <Input id="password" className="pl-10" type="password" autoComplete="current-password" {...register('password')} />
              </div>
              {errors.password && <p className="mt-1 text-sm text-fleet-red">{errors.password.message}</p>}
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-fleet-green hover:text-emerald-800"
              onClick={() => setError('Recuperacao de senha preparada para integracao de email. Use o admin inicial para acessar.')}
            >
              Recuperar senha
            </button>
          </form>
        </Card>
      </section>
    </main>
  );
}
