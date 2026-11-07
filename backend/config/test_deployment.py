"""Deployment settings are evaluated without reading a developer's secrets or DB."""
import os
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured


class DeploymentSettingsTests(unittest.TestCase):
    def settings(self, **environment):
        values = {'DJANGO_SECRET_KEY': 'unit-test-key', 'DEBUG': 'false', **environment}
        # The only external dependency is the optional developer dotenv file.
        with patch.dict(os.environ, values, clear=True), patch('dotenv.load_dotenv'):
            return runpy.run_path(str(Path(__file__).with_name('settings.py')))

    def test_supabase_postgres_url_is_used_when_database_url_is_empty(self):
        result = self.settings(VERCEL='1', DATABASE_URL='', POSTGRES_URL='postgresql://shop:p%40ss@pool.example:6543/main?sslmode=require')
        db = result['DATABASES']['default']
        self.assertEqual((db['NAME'], db['USER'], db['PASSWORD'], db['HOST'], db['PORT']),
                         ('main', 'shop', 'p@ss', 'pool.example', 6543))
        self.assertEqual(db['OPTIONS']['sslmode'], 'require')

    def test_explicit_database_url_has_priority_over_integration_url(self):
        result = self.settings(DATABASE_URL='postgresql://local:test-only@localhost/explicit',
                               POSTGRES_URL='postgresql://cloud:test-only@pool.example/integration')
        self.assertEqual(result['DATABASES']['default']['NAME'], 'explicit')

    def test_postgres_ssl_query_options_are_preserved_and_unknown_options_are_ignored(self):
        result = self.settings(DATABASE_URL='postgresql://user:test-only@db.example/main?sslmode=verify-full&channel_binding=require&connect_timeout=7&options=unsafe&unrelated=ignored')
        options = result['DATABASES']['default']['OPTIONS']
        self.assertEqual(options, {'sslmode': 'verify-full', 'channel_binding': 'require', 'connect_timeout': 7})

    def test_explicit_ssl_and_timeout_environment_override_url_options(self):
        result = self.settings(DATABASE_URL='postgresql://user:test-only@db.example/main?sslmode=require&connect_timeout=7',
                               POSTGRES_SSLMODE='verify-full', DATABASE_CONNECT_TIMEOUT='4')
        self.assertEqual(result['DATABASES']['default']['OPTIONS'], {'sslmode': 'verify-full', 'connect_timeout': 4})

    def test_serverless_connections_close_after_request_and_require_ssl(self):
        result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@db.example/main')
        db = result['DATABASES']['default']
        self.assertEqual(db['CONN_MAX_AGE'], 0)
        self.assertTrue(db['CONN_HEALTH_CHECKS'])
        self.assertEqual(db['OPTIONS'], {'sslmode': 'require', 'connect_timeout': 10, 'prepare_threshold': None})

    def test_serverless_connection_is_safe_with_supabase_transaction_pooler(self):
        result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@pool.example:6543/main')
        db = result['DATABASES']['default']
        self.assertIsNone(db['OPTIONS'].get('prepare_threshold', 'missing'))
        self.assertTrue(db.get('DISABLE_SERVER_SIDE_CURSORS'))

    def test_serverless_throttle_uses_shared_database_cache(self):
        result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@pool.example:6543/main')
        self.assertEqual(result.get('CACHES'), {'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': 'anasym_cache',
        }})

    def test_exact_platform_hosts_are_trusted_and_production_url_is_default(self):
        result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@pool.example/main',
                               VERCEL_URL='anasym-abc-team.vercel.app', VERCEL_PROJECT_PRODUCTION_URL='anasym-bakery.vercel.app')
        self.assertIn('anasym-abc-team.vercel.app', result['ALLOWED_HOSTS'])
        self.assertIn('https://anasym-bakery.vercel.app', result['CSRF_TRUSTED_ORIGINS'])
        self.assertNotIn('.vercel.app', result['ALLOWED_HOSTS'])
        self.assertEqual(result['FRONTEND_URL'], 'https://anasym-bakery.vercel.app')

    def test_explicit_frontend_url_has_priority_over_platform_default(self):
        result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@pool.example/main',
                               FRONTEND_URL='https://bakery.example/', VERCEL_PROJECT_PRODUCTION_URL='anasym-bakery.vercel.app')
        self.assertEqual(result['FRONTEND_URL'], 'https://bakery.example')

    def test_invalid_platform_hosts_are_not_trusted(self):
        invalid_hosts = ['https://evil.example', 'evil.example/path', 'evil.example:443', '*.vercel.app',
                         'bad..example', '-bad.example', 'bad.example?query', 'bad.example#fragment', 'user@evil.example']
        for host in invalid_hosts:
            with self.subTest(host=host):
                result = self.settings(VERCEL='1', POSTGRES_URL='postgresql://user:test-only@pool.example/main',
                                       VERCEL_URL=host, VERCEL_PROJECT_PRODUCTION_URL=host)
                self.assertNotIn(host, result['ALLOWED_HOSTS'])
                self.assertNotIn('https://' + host, result['CSRF_TRUSTED_ORIGINS'])
                self.assertEqual(result['FRONTEND_URL'], 'http://localhost:5173')

    def test_non_serverless_connection_lifetime_remains_configurable(self):
        result = self.settings(DATABASE_URL='postgresql://user:test-only@localhost/main', DATABASE_CONN_MAX_AGE='25')
        self.assertEqual(result['DATABASES']['default']['CONN_MAX_AGE'], 25)

    def test_serverless_cannot_silently_fall_back_to_ephemeral_sqlite(self):
        with self.assertRaises(ImproperlyConfigured):
            self.settings(VERCEL='1', USE_SQLITE='true')

    def test_serverless_does_not_import_local_dotenv_values(self):
        def import_developer_file(*args, **kwargs):
            os.environ.setdefault('DATABASE_URL', 'postgresql://local:test-only@localhost/local_only')

        environment = {'VERCEL': '1', 'DJANGO_SECRET_KEY': 'unit-test-key', 'POSTGRES_URL': 'postgresql://cloud:test-only@pool.example/cloud_db'}
        with patch.dict(os.environ, environment, clear=True), patch('dotenv.load_dotenv', side_effect=import_developer_file):
            result = runpy.run_path(str(Path(__file__).with_name('settings.py')))
        self.assertEqual(result['DATABASES']['default']['NAME'], 'cloud_db')
