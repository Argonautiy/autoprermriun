UPDATE auth.users
SET encrypted_password = crypt('admin12345a', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@gmail.com';