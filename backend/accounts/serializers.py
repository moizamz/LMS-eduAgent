from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'role', 'phone', 'profile_picture', 'bio', 'is_approved', 
                  'date_joined', 'created_at']
        read_only_fields = ['id', 'date_joined', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        min_length=6,
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True, 
        required=True,
        min_length=6,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 
                  'first_name', 'last_name', 'role', 'phone']
    
    def validate_password(self, value):
        # Basic validation - at least 6 characters
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters long.")
        return value
    
    def validate_role(self, value):
        # Prevent users from registering as admin
        if value == 'admin':
            raise serializers.ValidationError("Cannot register as admin. Please contact administrator.")
        return value
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password2": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        password2 = validated_data.pop('password2')
        password = validated_data.pop('password')
        role = validated_data.get('role', 'student')
        
        # Create user with password
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        
        # Auto-approve admin and students, instructors need approval
        if role == 'instructor':
            user.is_approved = False
        else:
            user.is_approved = True
        user.save()
        
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs

