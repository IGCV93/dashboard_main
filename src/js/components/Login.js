/**
 * Login Component - Authentication page
 */

(function() {
    'use strict';
    
    function Login({ onLogin }) {
        const { useState, useEffect, createElement: h } = React;
        
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [rememberMe, setRememberMe] = useState(false);
        const [showPassword, setShowPassword] = useState(false);
        const [showResetPassword, setShowResetPassword] = useState(false);
        const [resetEmail, setResetEmail] = useState('');
        const [resetSent, setResetSent] = useState(false);
        
        // Demo credentials for easy access
        const demoCredentials = [
            { email: 'demo-admin@chaivision.com', password: 'demo123', role: 'Admin' },
            { email: 'demo-manager@chaivision.com', password: 'demo123', role: 'Manager' },
            { email: 'demo-user@chaivision.com', password: 'demo123', role: 'User' }
        ];
        
        // Get Supabase client
        const getSupabaseClient = () => {
            const config = window.CONFIG || window.ChaiVision?.CONFIG;
            if (config?.SUPABASE?.URL && window.supabase) {
                return window.supabase.createClient(
                    config.SUPABASE.URL,
                    config.SUPABASE.ANON_KEY
                );
            }
            return null;
        };
        
        const handleLogin = async (e) => {
            e?.preventDefault();
            setError('');
            setLoading(true);
            
            const supabase = getSupabaseClient();
            
            if (!supabase) {
                // Demo mode fallback
                const demoUser = demoCredentials.find(d => d.email === email && d.password === password);
                if (demoUser) {
                    setTimeout(() => {
                        const user = {
                            id: 'demo-' + Date.now(),
                            email: demoUser.email,
                            role: demoUser.role,
                            full_name: `Demo ${demoUser.role}`,
                            is_demo_account: true
                        };
                        onLogin(user);
                        setLoading(false);
                    }, 500);
                } else {
                    setError('Invalid credentials');
                    setLoading(false);
                }
                return;
            }
            
            try {
                // Supabase authentication
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (authError) throw authError;
                
                // Get user profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();
                
                if (profileError) throw profileError;
                
                // Check if user is active
                if (profile.status !== 'active') {
                    await supabase.auth.signOut();
                    throw new Error('Your account is inactive. Please contact an administrator.');
                }
                
                // Update last login
                await supabase
                    .from('profiles')
                    .update({ 
                        last_login: new Date().toISOString(),
                        login_count: (profile.login_count || 0) + 1
                    })
                    .eq('id', data.user.id);
                
                // Log the login
                await supabase
                    .from('audit_logs')
                    .insert({
                        user_id: data.user.id,
                        user_email: email,
                        user_role: profile.role,
                        action: 'login',
                        action_details: {
                            timestamp: new Date().toISOString(),
                            remember_me: rememberMe
                        }
                    });
                
                // Set session persistence
                if (rememberMe) {
                    localStorage.setItem('chai_vision_remember', 'true');
                } else {
                    sessionStorage.setItem('chai_vision_session', 'true');
                }
                
                // Call parent login handler with full user data
                const userData = {
                    ...data.user,
                    ...profile
                };
                
                onLogin(userData);
                
            } catch (err) {
                console.error('Login error:', err);
                setError(err.message || 'Failed to login. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        
        const handleResetPassword = async () => {
            if (!resetEmail) {
                setError('Please enter your email address');
                return;
            }
            
            const supabase = getSupabaseClient();
            if (!supabase) {
                setError('Password reset not available in demo mode');
                return;
            }
            
            setLoading(true);
            setError('');
            
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                
                if (error) throw error;
                
                setResetSent(true);
                setError('');
            } catch (err) {
                setError(err.message || 'Failed to send reset email');
            } finally {
                setLoading(false);
            }
        };
        
        const fillDemoCredentials = (demo) => {
            setEmail(demo.email);
            setPassword(demo.password);
            setError('');
        };
        
        if (showResetPassword) {
            return h('div', { className: 'login-container' },
                h('div', { className: 'login-card' },
                    h('div', { className: 'login-logo' },
                        h('div', { className: 'logo-icon' }, 'CV'),
                        h('h1', null, 'Chai Vision'),
                        h('p', { className: 'login-subtitle' }, 'Reset Password')
                    ),
                    
                    resetSent ? h('div', { className: 'reset-success' },
                        h('div', { className: 'success-icon' }, '✅'),
                        h('h3', null, 'Check Your Email'),
                        h('p', null, `We've sent a password reset link to ${resetEmail}`),
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: () => {
                                setShowResetPassword(false);
                                setResetSent(false);
                                setResetEmail('');
                            }
                        }, 'Back to Login')
                    ) : h('div', { className: 'reset-form' },
                        h('p', { className: 'reset-instructions' }, 
                            'Enter your email address and we\'ll send you a link to reset your password.'),
                        
                        error && h('div', { className: 'login-error' }, error),
                        
                        h('div', { className: 'form-group' },
                            h('input', {
                                type: 'email',
                                placeholder: 'Email address',
                                value: resetEmail,
                                onChange: (e) => setResetEmail(e.target.value),
                                className: 'login-input',
                                disabled: loading
                            })
                        ),
                        
                        h('button', {
                            className: 'btn btn-primary',
                            onClick: handleResetPassword,
                            disabled: loading || !resetEmail
                        }, loading ? 'Sending...' : 'Send Reset Link'),
                        
                        h('button', {
                            className: 'btn btn-link',
                            onClick: () => {
                                setShowResetPassword(false);
                                setError('');
                            }
                        }, 'Back to Login')
                    )
                )
            );
        }
        
        return h('div', { className: 'login-container' },
            h('div', { className: 'login-card' },
                h('div', { className: 'login-logo' },
                    h('div', { className: 'logo-icon' }, 'CV'),
                    h('h1', null, 'Chai Vision'),
                    h('p', { className: 'login-subtitle' }, 'Sales Performance Dashboard')
                ),
                
                h('form', { className: 'login-form', onSubmit: handleLogin },
                    error && h('div', { className: 'login-error' }, error),
                    
                    h('div', { className: 'form-group' },
                        h('input', {
                            type: 'email',
                            placeholder: 'Email address',
                            value: email,
                            onChange: (e) => setEmail(e.target.value),
                            className: 'login-input',
                            required: true,
                            disabled: loading
                        })
                    ),
                    
                    h('div', { className: 'form-group' },
                        h('div', { className: 'password-input-wrapper' },
                            h('input', {
                                type: showPassword ? 'text' : 'password',
                                placeholder: 'Password',
                                value: password,
                                onChange: (e) => setPassword(e.target.value),
                                className: 'login-input',
                                required: true,
                                disabled: loading
                            }),
                            h('button', {
                                type: 'button',
                                className: 'password-toggle',
                                onClick: () => setShowPassword(!showPassword)
                            }, showPassword ? '👁️' : '👁️‍🗨️')
                        )
                    ),
                    
                    h('div', { className: 'form-options' },
                        h('label', { className: 'checkbox-label' },
                            h('input', {
                                type: 'checkbox',
                                checked: rememberMe,
                                onChange: (e) => setRememberMe(e.target.checked)
                            }),
                            h('span', null, 'Remember me')
                        ),
                        h('a', {
                            href: '#',
                            className: 'forgot-password',
                            onClick: (e) => {
                                e.preventDefault();
                                setShowResetPassword(true);
                                setError('');
                            }
                        }, 'Forgot password?')
                    ),
                    
                    h('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-login',
                        disabled: loading
                    }, loading ? 'Signing in...' : 'Sign in')
                ),
                
                h('div', { className: 'demo-credentials' },
                    h('p', { className: 'demo-title' }, 'Demo Credentials:'),
                    h('div', { className: 'demo-buttons' },
                        ...demoCredentials.map(demo =>
                            h('button', {
                                key: demo.role,
                                className: 'demo-btn',
                                onClick: () => fillDemoCredentials(demo),
                                title: `${demo.email} / ${demo.password}`
                            },
                                h('span', { className: 'demo-role' }, demo.role),
                                h('span', { className: 'demo-icon' }, 
                                    demo.role === 'Admin' ? '👑' : 
                                    demo.role === 'Manager' ? '📊' : '👤'
                                )
                            )
                        )
                    )
                )
            )
        );
    }
    
    // Make Login available globally
    window.Login = Login;
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.components = window.ChaiVision.components || {};
    window.ChaiVision.components.Login = Login;
})();
