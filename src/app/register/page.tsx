'use client';

import { useState, useTransition } from 'react';
import { registerUser } from '@/actions/auth';
import { Gavel, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    startTransition(async () => {
      const result = await registerUser(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Registration failed');
      }
    });
  };

  if (success) {
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-green-100 shadow-sm text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ArrowRight className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
                <p className="text-gray-500 mb-6">Your account has been successfully registered. You can now log in.</p>
                <Link href="/login" className="block w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700">
                    Go to Login
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Create an Account</h1>
          <p className="text-sm text-gray-500 mt-1">Join the marketplace today</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">First Name</label>
                        <input
                            required
                            type="text"
                            value={formData.firstName}
                            onChange={e => setFormData({...formData, firstName: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Last Name</label>
                        <input
                            required
                            type="text"
                            value={formData.lastName}
                            onChange={e => setFormData({...formData, lastName: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email Address</label>
                    <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
                    <input
                        required
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Confirm Password</label>
                    <input
                        required
                        type="password"
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-primary-600 font-semibold hover:underline">Log in</Link>
            </p>
        </div>
      </div>
    </div>
  );
}
