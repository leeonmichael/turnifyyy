from django.db import models

class Turn(models.Model):
    number=models.CharField(max_length=10)
    status=models.CharField(max_length=20,default="waiting")
    priority=models.IntegerField(default=0, help_text="Priority level for VIP customers")
    service_type=models.CharField(max_length=50, default="general", help_text="Type of service: general, preferential, emergency, virtual")
    assigned_employee=models.CharField(max_length=100, blank=True, help_text="Employee assigned to this turn")
    created_at=models.DateTimeField(auto_now_add=True)
    finished_at=models.DateTimeField(null=True, blank=True)
    required_documents=models.JSONField(default=list, blank=True, help_text="Documents required by employee")
    uploaded_documents=models.JSONField(default=list, blank=True, help_text="Documents uploaded by user")
    documents_pending=models.IntegerField(default=0, help_text="Count of pending documents")
    documents_approved=models.IntegerField(default=0, help_text="Count of approved documents")
    documents_rejected=models.IntegerField(default=0, help_text="Count of rejected documents")
    sede=models.CharField(max_length=100, blank=True, default="MOSQUERA", help_text="Office location")
    def __str__(self):
        return self.number

class Register(models.Model):
    username=models.CharField(max_length=100, unique=True)
    password=models.CharField(max_length=255)
    role=models.CharField(max_length=20, default="client")
    full_name=models.CharField(max_length=200, blank=True, default="")
    document_type=models.CharField(max_length=20, default="CC", help_text="CC, CE, PA, NIT")
    cedula=models.CharField(max_length=50, blank=True, default="")
    email=models.EmailField(max_length=254, blank=True, default="")
    phone=models.CharField(max_length=50, blank=True, default="")
    cargo=models.CharField(max_length=100, blank=True, default="", help_text="Position/Grade")
    entidad=models.CharField(max_length=200, blank=True, default="", help_text="Entity")
    sede=models.CharField(max_length=200, blank=True, default="", help_text="Office/Branch")
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.username

class Sede(models.Model):
    name=models.CharField(max_length=200, unique=True)
    city=models.CharField(max_length=100, blank=True, default="")
    address=models.CharField(max_length=255, blank=True, default="")
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
