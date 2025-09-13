'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt?: string;
  lastLogin?: string;
}

interface ProfileData {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      router.push('/login');
    }
  };

  const validateProfileForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (profileData.name && profileData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters long';
    }

    if (profileData.newPassword) {
      if (!profileData.currentPassword) {
        newErrors.currentPassword = 'Current password is required to change password';
      }
      if (profileData.newPassword.length < 8) {
        newErrors.newPassword = 'New password must be at least 8 characters long';
      }
      if (profileData.newPassword !== profileData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProfileForm()) return;

    setIsUpdating(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const updateData: any = {};
      
      if (profileData.name && profileData.name !== user?.name) {
        updateData.name = profileData.name;
      }
      
      if (profileData.newPassword) {
        updateData.currentPassword = profileData.currentPassword;
        updateData.newPassword = profileData.newPassword;
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.message || 'Update failed' });
        return;
      }

      setUser(prev => prev ? { ...prev, ...data.user } : null);
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);
      setProfileData({
        name: data.user.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/profile', {
          credentials: 'include',
        });

        if (!res.ok) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        setUser(data.user);
        setProfileData(prev => ({
          ...prev,
          name: data.user.name || ''
        }));
      } catch (err) {
        console.error('Profile fetch error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-24 w-24 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Welcome, {user.name || 'User'}!
          </h1>
          <p className="mt-2 text-sm text-gray-600">{user.email}</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
            <div className="space-x-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setErrors({});
                    setSuccessMessage('');
                    setProfileData({
                      name: user.name || '',
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-150 ease-in-out"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Card Content */}
          <div className="px-6 py-6">
            {successMessage && (
              <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
                {successMessage}
              </div>
            )}

            {errors.general && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                {errors.general}
              </div>
            )}

            {!isEditing ? (
              /* View Mode */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {user.name || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {user.email}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Member Since
                    </label>
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {user.createdAt 
                        ? new Date(user.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Unknown'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Login
                    </label>
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {user.lastLogin 
                        ? new Date(user.lastLogin).toLocaleString()
                        : 'Unknown'
                      }
                    </p>
                  </div>
                </div>

                {/* Account Stats */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-indigo-600">1</div>
                    <div className="text-sm text-indigo-800">Active Account</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">✓</div>
                    <div className="text-sm text-green-800">Email Verified</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">🔒</div>
                    <div className="text-sm text-blue-800">Secure Login</div>
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>
                </div>

                {/* Password Change Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        id="currentPassword"
                        type="password"
                        value={profileData.currentPassword}
                        onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out ${
                          errors.currentPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter current password"
                      />
                      {errors.currentPassword && (
                        <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                          New Password
                        </label>
                        <input
                          id="newPassword"
                          type="password"
                          value={profileData.newPassword}
                          onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out ${
                            errors.newPassword ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter new password"
                        />
                        {errors.newPassword && (
                          <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          id="confirmPassword"
                          type="password"
                          value={profileData.confirmPassword}
                          onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out ${
                            errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Confirm new password"
                        />
                        {errors.confirmPassword && (
                          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 bg-yellow-50 p-3 rounded-md">
                      <p className="font-medium mb-1">Note:</p>
                      <p>Leave password fields empty if you don't want to change your password.</p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                  >
                    {isUpdating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security Settings Card */}
        <div className="mt-8 bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Security & Privacy</h2>
          </div>
          <div className="px-6 py-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                </div>
                <button className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out">
                  Enable
                </button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Login Notifications</h3>
                  <p className="text-sm text-gray-600">Get notified of new sign-ins to your account</p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    defaultChecked
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
                </div>
                <button className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-150 ease-in-out">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}